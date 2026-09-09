/**
 * One-time backfill: reassigning a group's teacher (assignTeacherToGroup /
 * updateGroup) used to update Group.teacherId without touching already-created
 * ClassSession rows for that group, so those sessions silently fell off the
 * new teacher's schedule/lessons list and 404'd on the lesson detail page
 * (fixed going forward in app/crm/(dashboard)/groups/actions.ts). This finds
 * every GROUP session whose teacherId no longer matches its group's current
 * teacher -- including the 08.09 "Математика Таня, Юля" lesson -- and
 * retags it.
 *
 * Dry run by default: prints what it WOULD change. Pass --apply to write.
 *
 * A session is SKIPPED even with --apply when its month already has a
 * TeacherPayout recorded for its current (old) teacherId -- retagging it
 * would silently move salary from one teacher to another after that payout
 * period was already closed and paid out. Those need manual review.
 *
 * Run: npx tsx scripts/fix-orphaned-lessons.ts [--apply]
 */
import "dotenv/config";
import { db } from "@/shared/lib/db";

async function main() {
  const apply = process.argv.includes("--apply");

  const groupSessions = await db.classSession.findMany({
    where: { groupId: { not: null } },
    select: {
      id: true,
      scheduledAt: true,
      teacherId: true,
      status: true,
      group: { select: { id: true, name: true, teacherId: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const mismatched = groupSessions.filter(
    (s) => s.group?.teacherId && s.teacherId !== s.group.teacherId,
  );

  if (mismatched.length === 0) {
    console.log("No orphaned lessons found -- every session's teacherId matches its group's current teacher.");
    return;
  }

  console.log(`Found ${mismatched.length} session(s) whose teacherId is stale.\n`);

  let fixed = 0;
  let skipped = 0;

  for (const session of mismatched) {
    const newTeacherId = session.group!.teacherId!;
    const scheduledAt = session.scheduledAt;
    const monthStart = new Date(Date.UTC(scheduledAt.getUTCFullYear(), scheduledAt.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(scheduledAt.getUTCFullYear(), scheduledAt.getUTCMonth() + 1, 1));

    const closedPayout = await db.teacherPayout.findFirst({
      where: {
        teacherId: session.teacherId,
        periodFrom: { lt: monthEnd },
        periodTo: { gt: monthStart },
      },
      select: { id: true },
    });

    const label = `session ${session.id} "${session.group!.name}" @ ${scheduledAt.toISOString()} (status=${session.status}): ${session.teacherId} -> ${newTeacherId}`;

    if (closedPayout) {
      console.warn(`SKIP (closed payout period for old teacher) ${label}`);
      skipped++;
      continue;
    }

    console.log(`${apply ? "FIX" : "WOULD FIX"} ${label}`);

    if (apply) {
      await db.classSession.update({
        where: { id: session.id },
        data: { teacherId: newTeacherId },
      });
    }
    fixed++;
  }

  console.log(
    `\n${apply ? "Fixed" : "Would fix"} ${fixed} session(s); skipped ${skipped} due to a closed payout period.`,
  );
  if (!apply && fixed > 0) {
    console.log("Re-run with --apply to write these changes.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
