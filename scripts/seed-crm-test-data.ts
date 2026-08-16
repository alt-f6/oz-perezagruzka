/**
 * Seed script: ready-to-use test accounts + connected demo CRM data
 * for manual testing.
 *
 * Idempotent: users are upserted by email, demo entities are upserted by
 * their natural keys (phone / name / idempotencyKey), so the script can be
 * re-run safely.
 *
 * Run: npx tsx scripts/seed-crm-test-data.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "@/shared/lib/db";
import type { Role } from "@prisma/client";

const PASSWORD = "Test1234!";

const ACCOUNTS: { email: string; fullName: string; role: Role; phone: string }[] = [
  { email: "admin@test.ru", fullName: "Тест Администратор", role: "ADMIN", phone: "+79990000001" },
  { email: "manager@test.ru", fullName: "Тест Менеджер", role: "MANAGER", phone: "+79990000002" },
  { email: "teacher@test.ru", fullName: "Тест Преподаватель", role: "TEACHER", phone: "+79990000003" },
  { email: "student@test.ru", fullName: "Тест Ученик", role: "STUDENT", phone: "+79990000004" },
  { email: "parent@test.ru", fullName: "Тест Родитель", role: "PARENT", phone: "+79990000005" },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── 1. Users ────────────────────────────────────────────────
  const users: Record<string, { id: string; email: string }> = {};
  for (const acc of ACCOUNTS) {
    const user = await db.user.upsert({
      where: { email: acc.email },
      update: { passwordHash, role: acc.role, fullName: acc.fullName },
      create: {
        email: acc.email,
        passwordHash,
        role: acc.role,
        fullName: acc.fullName,
        phone: acc.phone,
      },
    });
    users[acc.role] = { id: user.id, email: acc.email };
    console.log(`✅ User ${acc.role.padEnd(7)} ${acc.email}`);
  }

  // ── 2. Group "МАТ-101" (subject: Математика ОГЭ) ────────────
  const teacherId = users.TEACHER.id;
  let group = await db.group.findFirst({
    where: { name: "МАТ-101", deletedAt: null },
  });
  if (!group) {
    group = await db.group.create({
      data: { name: "МАТ-101", teacherId, pricePerLesson: 1250 },
    });
    console.log(`✅ Group "МАТ-101" created (teacher: teacher@test.ru, 1250 ₽/lesson)`);
  } else {
    group = await db.group.update({ where: { id: group.id }, data: { teacherId } });
    console.log(`✅ Group "МАТ-101" already exists — teacher re-linked`);
  }

  // ── 3. Student profile linked to student@test.ru ────────────
  let student = await db.student.findFirst({
    where: { userId: users.STUDENT.id, deletedAt: null },
  });
  if (!student) {
    student = await db.student.create({
      data: {
        userId: users.STUDENT.id,
        fullName: "Тест Ученик",
        phone: "+79990000004",
      },
    });
    console.log(`✅ Student profile created for student@test.ru`);
  } else {
    console.log(`✅ Student profile already exists for student@test.ru`);
  }

  // Exam goal, carries the subject "Математика ОГЭ" (no separate Subject model)
  await db.studentExamGoal.upsert({
    where: { studentId_subject: { studentId: student.id, subject: "Математика ОГЭ" } },
    update: {},
    create: { studentId: student.id, subject: "Математика ОГЭ", startScore: 12, targetScore: 27 },
  });
  console.log(`✅ Exam goal "Математика ОГЭ" (12 → 27) attached`);

  // Enroll into group
  await db.groupStudent.upsert({
    where: { groupId_studentId: { groupId: group.id, studentId: student.id } },
    update: {},
    create: { groupId: group.id, studentId: student.id },
  });
  console.log(`✅ Student enrolled in "МАТ-101"`);

  // Initial balance: 5000 ₽ payment (idempotent via idempotencyKey)
  await db.transaction.upsert({
    where: { idempotencyKey: "seed-test-initial-balance" },
    update: {},
    create: {
      studentId: student.id,
      amount: 5000,
      type: "PAYMENT",
      description: "Стартовый баланс (тестовые данные)",
      idempotencyKey: "seed-test-initial-balance",
    },
  });
  console.log(`✅ Initial balance: +5000 ₽ (PAYMENT)`);

  // ── 4. Parent linked to parent@test.ru and to the student ───
  const parent = await db.parent.upsert({
    where: { phone: "+79990000005" },
    update: { userId: users.PARENT.id },
    create: {
      userId: users.PARENT.id,
      fullName: "Тест Родитель",
      phone: "+79990000005",
    },
  });
  await db.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
    update: {},
    create: { parentId: parent.id, studentId: student.id },
  });
  console.log(`✅ Parent profile linked to student`);

  // ── 5. Lead funnel: 3 demo leads at different stages ────────
  const leads = [
    {
      phone: "+79991110001",
      name: "Демо Лид — Иван",
      parentName: "Ольга Иванова",
      subject: "Математика ОГЭ",
      status: "NEW" as const,
      notes: "Первичный контакт: оставил заявку с лендинга",
    },
    {
      phone: "+79991110002",
      name: "Демо Лид — Мария",
      parentName: "Сергей Петров",
      subject: "Математика ОГЭ",
      status: "DIAGNOSTIC_SCHEDULED" as const,
      notes: "Назначена диагностика на ближайшую субботу",
    },
    {
      phone: "+79991110003",
      name: "Демо Лид — Артём",
      parentName: "Анна Сидорова",
      subject: "Математика ОГЭ",
      status: "DIAGNOSTIC_CONDUCTED" as const,
      notes: "Диагностика проведена, готов к оплате",
    },
  ];
  for (const lead of leads) {
    await db.lead.upsert({
      where: { phone: lead.phone },
      update: { status: lead.status, notes: lead.notes },
      create: { ...lead, source: "OTHER" },
    });
    console.log(`✅ Lead "${lead.name}" — ${lead.status}`);
  }

  console.log("\n🎉 Seed complete. All accounts use password: Test1234!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
