/**
 * One-time repair: before the future-lesson billing guard existed, the
 * lesson journal could mark a not-yet-started lesson PRESENT and charge it
 * (picking the status directly, or implicitly via saving a grade/homework/
 * comment before the status dropdown was ever touched). This finds every
 * Attendance row still stuck in that state -- status PRESENT, but created
 * before its own lesson's attendance window (15 minutes pre-start) had
 * opened -- reverses any resulting LESSON_CHARGE with a compensating
 * ADJUSTMENT transaction (the ledger is append-only: LESSON_CHARGE rows are
 * never deleted or edited), and resets the Attendance record so it no
 * longer reads as attended.
 *
 * Dry run by default: prints what it WOULD change. Pass --apply to write.
 *
 * Run: npx tsx scripts/revert-premature-attendance.ts [--apply]
 */
import "dotenv/config";
import { db } from "@/shared/lib/db";
import { ATTENDANCE_PRE_WINDOW_MS } from "@/crm/lib/lessonTime";

async function main() {
  const apply = process.argv.includes("--apply");

  const presentRecords = await db.attendance.findMany({
    where: { status: "PRESENT" },
    select: {
      id: true,
      createdAt: true,
      classSessionId: true,
      studentId: true,
      classSession: { select: { scheduledAt: true } },
      student: { select: { fullName: true } },
    },
  });

  const targets = presentRecords.filter(
    (a) =>
      a.createdAt.getTime() <
      a.classSession.scheduledAt.getTime() - ATTENDANCE_PRE_WINDOW_MS,
  );

  if (targets.length === 0) {
    console.log("No premature PRESENT attendance found -- nothing to revert.");
    return;
  }

  console.log(`Found ${targets.length} premature PRESENT record(s).\n`);

  let reverted = 0;
  let skipped = 0;

  for (const record of targets) {
    const label = `attendance ${record.id} (student "${record.student.fullName}", session ${record.classSessionId}, scheduled ${record.classSession.scheduledAt.toISOString()}, marked ${record.createdAt.toISOString()})`;
    const idempotencyKey = `revert_premature:${record.classSessionId}:${record.studentId}`;

    const alreadyReverted = await db.transaction.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (alreadyReverted) {
      console.log(`SKIP (already reverted) ${label}`);
      skipped++;
      continue;
    }

    const charge = await db.transaction.findFirst({
      where: {
        studentId: record.studentId,
        classSessionId: record.classSessionId,
        type: "LESSON_CHARGE",
      },
      select: { id: true, amount: true },
    });

    console.log(
      `${apply ? "REVERT" : "WOULD REVERT"} ${label}` +
        (charge
          ? ` -- refunding ${Number(charge.amount) * -1} (compensating charge ${charge.id})`
          : " -- no LESSON_CHARGE found, resetting status only"),
    );

    if (apply) {
      await db.$transaction(async (tx) => {
        if (charge) {
          await tx.transaction.create({
            data: {
              studentId: record.studentId,
              classSessionId: record.classSessionId,
              amount: Number(charge.amount) * -1,
              type: "ADJUSTMENT",
              idempotencyKey,
              description: `Корректировка: откат ошибочного досрочного списания за урок ${record.classSessionId}`,
            },
          });
        }
        await tx.attendance.update({
          where: { id: record.id },
          data: { status: null },
        });
      });
    }
    reverted++;
  }

  console.log(
    `\n${apply ? "Reverted" : "Would revert"} ${reverted} record(s); skipped ${skipped} already-reverted.`,
  );
  if (!apply && reverted > 0) {
    console.log("Re-run with --apply to write these changes.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
