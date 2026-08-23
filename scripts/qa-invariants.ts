/**
 * Stage 3 QA: financial & business invariant verification.
 *
 * Standalone integration tests that exercise the real service code
 * (BillingService, finalizeSuccessfulPayment, computeTeacherSalary,
 * performLeadConversion) against the database configured in .env.
 *
 * All fixtures are created with a unique __QA__ marker and removed in a
 * finally block, so the script is safe to run on a shared dev database.
 *
 * Run: npm run test  (or: npx tsx scripts/qa-invariants.ts)
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { db } from "@/shared/lib/db";
import { BillingService } from "@/crm/lib/services/billing.service";
import { finalizeSuccessfulPayment } from "@/crm/lib/services/yookassa.service";
import { rublesToKopecks } from "@/crm/lib/money";
import { computeTeacherSalary } from "@/crm/lib/services/salary.service";
import { performLeadConversion } from "@/crm/lib/services/lead-conversion.service";

const RUN_ID = randomUUID().slice(0, 8);
const MARK = `__QA__${RUN_ID}`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${label}`, detail !== undefined ? JSON.stringify(detail) : "");
  }
}

// Unique-per-run phone numbers to avoid unique-constraint collisions.
let phoneSeq = 0;
function nextPhone(): string {
  const base = Date.now().toString().slice(-7);
  phoneSeq += 1;
  return `+7999${base.slice(0, 7 - String(phoneSeq).length)}${phoneSeq}`;
}

async function chargeCount(studentId: string, classSessionId: string) {
  return db.transaction.count({
    where: { studentId, classSessionId, type: "LESSON_CHARGE" },
  });
}

async function main() {
  console.log(`QA invariants run ${MARK}\n`);

  // ---------- shared fixtures ----------
  const teacher = await db.user.create({
    data: { fullName: `${MARK} teacher`, role: "TEACHER" },
  });
  const group = await db.group.create({
    data: { name: `${MARK} group`, teacherId: teacher.id, pricePerLesson: 1000 },
  });
  const student = await db.student.create({
    data: { fullName: `${MARK} student`, phone: nextPhone() },
  });
  await db.groupStudent.create({
    data: { groupId: group.id, studentId: student.id },
  });
  const session1 = await db.classSession.create({
    data: {
      groupId: group.id,
      teacherId: teacher.id,
      scheduledAt: new Date("2026-08-03T10:00:00.000Z"),
    },
  });

  // Salary fixtures use a dedicated teacher so charges from other tests
  // cannot leak into the computation.
  const salaryTeacher = await db.user.create({
    data: { fullName: `${MARK} salary-teacher`, role: "TEACHER" },
  });
  const salaryGroup = await db.group.create({
    data: {
      name: `${MARK} salary-group`,
      teacherId: salaryTeacher.id,
      pricePerLesson: 1500,
    },
  });
  const salaryStudents = await Promise.all(
    [1, 2, 3].map(() =>
      db.student.create({
        data: { fullName: `${MARK} salary-student`, phone: nextPhone() },
      }),
    ),
  );
  const salarySession1 = await db.classSession.create({
    data: {
      groupId: salaryGroup.id,
      teacherId: salaryTeacher.id,
      scheduledAt: new Date("2026-07-10T10:00:00.000Z"),
    },
  });
  const salarySession2 = await db.classSession.create({
    data: {
      groupId: salaryGroup.id,
      teacherId: salaryTeacher.id,
      scheduledAt: new Date("2026-07-17T10:00:00.000Z"),
    },
  });

  const leadPhoneOk = nextPhone();
  const leadPhoneConflict = nextPhone();
  const lead1 = await db.lead.create({
    data: { name: `${MARK} lead-ok`, phone: leadPhoneOk, status: "NEW" },
  });
  const lead2 = await db.lead.create({
    data: { name: `${MARK} lead-conflict`, phone: leadPhoneConflict, status: "NEW" },
  });
  const conflictStudent = await db.student.create({
    data: { fullName: `${MARK} conflict-student`, phone: leadPhoneConflict },
  });

  try {
    // ---------- 1. Attendance charge invariant ----------
    console.log("1. BillingService.markAttendanceAndCharge — единственность LESSON_CHARGE");

    await BillingService.markAttendanceAndCharge(session1.id, student.id, "PRESENT");
    assert(
      (await chargeCount(student.id, session1.id)) === 1,
      "PRESENT создаёт ровно одну LESSON_CHARGE",
    );
    const chargeRow = await db.transaction.findFirst({
      where: { studentId: student.id, classSessionId: session1.id, type: "LESSON_CHARGE" },
    });
    assert(
      Number(chargeRow?.amount) === -1000,
      "Сумма списания равна -pricePerLesson (-1000)",
      chargeRow?.amount,
    );

    await BillingService.markAttendanceAndCharge(session1.id, student.id, "EXCUSED");
    assert(
      (await chargeCount(student.id, session1.id)) === 0,
      "PRESENT→EXCUSED снимает списание (0 LESSON_CHARGE)",
    );

    await BillingService.markAttendanceAndCharge(session1.id, student.id, "ABSENT");
    assert(
      (await chargeCount(student.id, session1.id)) === 1,
      "EXCUSED→ABSENT возвращает ровно одну LESSON_CHARGE",
    );

    const attendanceRows = await db.attendance.count({
      where: { classSessionId: session1.id, studentId: student.id },
    });
    assert(attendanceRows === 1, "Attendance upsert: одна запись посещаемости");

    // Parallel marking: Serializable + FOR UPDATE must not duplicate charges.
    const parallel = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        BillingService.markAttendanceAndCharge(session1.id, student.id, "PRESENT"),
      ),
    );
    const okCalls = parallel.filter((r) => r.status === "fulfilled").length;
    assert(
      okCalls >= 1 && (await chargeCount(student.id, session1.id)) === 1,
      `5 параллельных вызовов (${okCalls} успешных) → ровно одна LESSON_CHARGE`,
    );

    // ---------- 2. Freeze protection ----------
    console.log("\n2. Заморозка — отметка в замороженный период не списывает деньги");

    const frozenSession = await db.classSession.create({
      data: {
        groupId: group.id,
        teacherId: teacher.id,
        scheduledAt: new Date("2026-08-05T10:00:00.000Z"),
      },
    });
    await db.freeze.create({
      data: {
        studentId: student.id,
        startDate: new Date("2026-08-04T00:00:00.000Z"),
        endDate: new Date("2026-08-06T00:00:00.000Z"),
      },
    });

    await BillingService.markAttendanceAndCharge(frozenSession.id, student.id, "PRESENT");
    const frozenAttendance = await db.attendance.count({
      where: { classSessionId: frozenSession.id, studentId: student.id },
    });
    assert(frozenAttendance === 1, "Посещаемость в заморозку фиксируется");
    assert(
      (await chargeCount(student.id, frozenSession.id)) === 0,
      "PRESENT в активную заморозку → 0 LESSON_CHARGE",
    );

    // Session on the day right after the freeze must charge normally.
    const unfrozenSession = await db.classSession.create({
      data: {
        groupId: group.id,
        teacherId: teacher.id,
        scheduledAt: new Date("2026-08-07T10:00:00.000Z"),
      },
    });
    await BillingService.markAttendanceAndCharge(unfrozenSession.id, student.id, "PRESENT");
    assert(
      (await chargeCount(student.id, unfrozenSession.id)) === 1,
      "PRESENT вне периода заморозки списывается как обычно",
    );

    // ---------- 3. Payment idempotency ----------
    console.log("\n3. finalizeSuccessfulPayment — идемпотентность webhook");

    const yookassaId = `qa_${RUN_ID}_${randomUUID()}`;
    await db.paymentIntent.create({
      data: { studentId: student.id, yookassaId, amount: 5000, status: "PENDING" },
    });

    const first = await finalizeSuccessfulPayment({
      paymentId: yookassaId,
      studentId: student.id,
      amount: rublesToKopecks(5000),
    });
    const second = await finalizeSuccessfulPayment({
      paymentId: yookassaId,
      studentId: student.id,
      amount: rublesToKopecks(5000),
    });
    const duplicateParallel = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        finalizeSuccessfulPayment({
          paymentId: yookassaId,
          studentId: student.id,
          amount: rublesToKopecks(5000),
        }),
      ),
    );

    assert(first === true, "Первый webhook зачисляет платёж (true)");
    assert(second === false, "Повторный webhook отклонён (false)");
    assert(
      duplicateParallel.every((r) => r.status === "fulfilled" && r.value === false),
      "3 параллельных повтора webhook → все отклонены",
    );

    const paymentTxs = await db.transaction.count({
      where: { studentId: student.id, type: "PAYMENT", idempotencyKey: yookassaId },
    });
    assert(paymentTxs === 1, "Ровно одна транзакция PAYMENT по idempotencyKey");

    const intent = await db.paymentIntent.findUnique({ where: { yookassaId } });
    assert(intent?.status === "SUCCEEDED", "PaymentIntent переведён в SUCCEEDED");

    // ---------- 4. Lead conversion ----------
    console.log("\n4. convertLeadToStudent — атомарность и защита от дублей");

    const conv1 = await performLeadConversion(lead1.id);
    assert(!conv1.error, "Успешная конвертация лида без ошибок", conv1.error);

    const convertedLead = await db.lead.findUnique({ where: { id: lead1.id } });
    const createdStudent = await db.student.findUnique({
      where: { phone: leadPhoneOk },
    });
    assert(
      convertedLead?.status === "CONVERTED" && Boolean(convertedLead?.convertedUserId),
      "Лид получает статус CONVERTED и ссылку на пользователя",
    );
    assert(
      Boolean(createdStudent?.userId),
      "Созданы связанные User + Student в одной транзакции",
    );

    const convRepeat = await performLeadConversion(lead1.id);
    assert(
      Boolean(convRepeat.error),
      "Повторная конвертация того же лида отклонена",
    );

    const usersBefore = await db.user.count({ where: { fullName: lead2.name } });
    const convConflict = await performLeadConversion(lead2.id);
    const usersAfter = await db.user.count({ where: { fullName: lead2.name } });
    assert(
      Boolean(convConflict.error),
      "Конвертация при конфликте телефона отклонена",
    );
    assert(
      usersBefore === usersAfter,
      "Атомарность: при отказе не остаётся orphan-пользователя",
    );

    // ---------- 5. Salary calculation ----------
    console.log("\n5. Зарплата — все три типа ставок на фикстурах");

    // salarySession1: PRESENT, ABSENT, EXCUSED marks (price 1500).
    await BillingService.markAttendanceAndCharge(
      salarySession1.id,
      salaryStudents[0].id,
      "PRESENT",
    );
    await BillingService.markAttendanceAndCharge(
      salarySession1.id,
      salaryStudents[1].id,
      "ABSENT",
    );
    await BillingService.markAttendanceAndCharge(
      salarySession1.id,
      salaryStudents[2].id,
      "EXCUSED",
    );
    // salarySession2 remains without attendance → not "conducted".

    const from = new Date("2026-07-01T00:00:00.000Z");
    const to = new Date("2026-08-01T00:00:00.000Z");

    await db.teacherRate.create({
      data: {
        teacherId: salaryTeacher.id,
        rateType: "FIXED_PER_LESSON",
        value: 700,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const fixed = await computeTeacherSalary(salaryTeacher.id, from, to);
    assert(
      fixed?.rateType === "FIXED_PER_LESSON" && fixed.basis === 1 && fixed.amount === 700,
      "FIXED_PER_LESSON: 1 проведённое занятие × 700 = 700",
      fixed,
    );

    await db.teacherRate.create({
      data: {
        teacherId: salaryTeacher.id,
        rateType: "PER_HEAD",
        value: 300,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    });
    const perHead = await computeTeacherSalary(salaryTeacher.id, from, to);
    assert(
      perHead?.rateType === "PER_HEAD" && perHead.basis === 2 && perHead.amount === 600,
      "PER_HEAD: 2 оплачиваемые отметки (PRESENT+ABSENT) × 300 = 600",
      perHead,
    );

    await db.teacherRate.create({
      data: {
        teacherId: salaryTeacher.id,
        rateType: "PERCENTAGE",
        value: 10,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    });
    const percentage = await computeTeacherSalary(salaryTeacher.id, from, to);
    assert(
      percentage?.rateType === "PERCENTAGE" &&
        percentage.basis === 3000 &&
        percentage.amount === 300,
      "PERCENTAGE: 10% от списанных 3000 (2×1500) = 300",
      percentage,
    );

    const noRate = await computeTeacherSalary(teacher.id, from, to);
    assert(noRate === null, "Преподаватель без ставки → null (NO_RATE)");
  } finally {
    // ---------- cleanup ----------
    console.log("\nОчистка тестовых данных...");
    const studentIds = [
      student.id,
      conflictStudent.id,
      ...salaryStudents.map((s) => s.id),
    ];
    const qaStudents = await db.student.findMany({
      where: { fullName: { startsWith: MARK } },
      select: { id: true },
    });
    const allStudentIds = [...new Set([...studentIds, ...qaStudents.map((s) => s.id)])];

    await db.transaction.deleteMany({ where: { studentId: { in: allStudentIds } } });
    await db.paymentIntent.deleteMany({ where: { studentId: { in: allStudentIds } } });
    await db.freeze.deleteMany({ where: { studentId: { in: allStudentIds } } });
    await db.attendance.deleteMany({ where: { studentId: { in: allStudentIds } } });
    await db.classSession.deleteMany({
      where: { teacherId: { in: [teacher.id, salaryTeacher.id] } },
    });
    await db.groupStudent.deleteMany({ where: { studentId: { in: allStudentIds } } });
    await db.group.deleteMany({
      where: { teacherId: { in: [teacher.id, salaryTeacher.id] } },
    });
    await db.student.deleteMany({ where: { id: { in: allStudentIds } } });

    // Lead conversion created a User (role STUDENT) linked to lead1.
    const convertedLeadRow = await db.lead.findUnique({ where: { id: lead1.id } });
    await db.lead.deleteMany({ where: { id: { in: [lead1.id, lead2.id] } } });
    if (convertedLeadRow?.convertedUserId) {
      await db.user.deleteMany({ where: { id: convertedLeadRow.convertedUserId } });
    }
    await db.teacherRate.deleteMany({
      where: { teacherId: { in: [teacher.id, salaryTeacher.id] } },
    });
    await db.user.deleteMany({ where: { id: { in: [teacher.id, salaryTeacher.id] } } });
    console.log("Очистка завершена.");
  }

  console.log(`\nИтог: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("QA run crashed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
