import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { getNotificationProvider } from "@/crm/lib/services/notification.service";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { createLogger } from "@/shared/lib/logger";
import { recordFailure } from "@/shared/lib/notification-metrics";

export const runtime = "nodejs";

const log = createLogger("lesson-reminders");

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 200;

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function fetchReminderBatch(now: Date, windowEnd: Date, cursor?: string) {
  return db.classSession.findMany({
    where: {
      scheduledAt: { gte: now, lte: windowEnd },
      reminderSentAt: null,
      status: "scheduled",
    },
    select: {
      id: true,
      scheduledAt: true,
      group: {
        select: {
          name: true,
          students: {
            select: {
              student: {
                select: {
                  fullName: true,
                  deletedAt: true,
                  parents: {
                    select: {
                      parent: { select: { telegramChatId: true, user: { select: { email: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // INDIVIDUAL sessions have no group; the single student is joined directly.
      student: {
        select: {
          fullName: true,
          deletedAt: true,
          parents: {
            select: {
              parent: { select: { telegramChatId: true, user: { select: { email: true } } } },
            },
          },
        },
      },
    },
    orderBy: { id: "asc" },
    take: BATCH_SIZE,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

async function findAllReminderSessions(now: Date, windowEnd: Date) {
  const sessions: Awaited<ReturnType<typeof fetchReminderBatch>> = [];
  let cursor: string | undefined;

  for (;;) {
    const batch = await fetchReminderBatch(now, windowEnd, cursor);
    sessions.push(...batch);
    if (batch.length < BATCH_SIZE) break;
    cursor = batch[batch.length - 1]!.id;
  }

  return sessions;
}

// External trigger (Vercel Cron / systemd timer): sends Telegram reminders to
// the parents of every student whose group has a class in the next 24 hours.
// `ClassSession.reminderSentAt` guards against duplicate sends across runs.
// Sessions are fetched in cursor-paginated batches so the window is never
// silently truncated once it exceeds a single batch.
export const GET = withApiErrors(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : req.nextUrl.searchParams.get("secret") ?? "";

  if (!provided || !secretsMatch(provided, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const sessions = await findAllReminderSessions(now, windowEnd);

  const provider = getNotificationProvider();
  let notifications = 0;
  let failedSessions = 0;

  for (const session of sessions) {
    let hadFailure = false;

    // Unified roster: a GROUP session's group members, or the single student of
    // an INDIVIDUAL session. The reminder shows the group name or a 1-on-1 label.
    const roster = session.group
      ? session.group.students.map((gs) => gs.student)
      : session.student
        ? [session.student]
        : [];
    const lessonName = session.group?.name ?? "Индивидуальное занятие";

    for (const student of roster) {
      if (student.deletedAt) continue;
      for (const { parent } of student.parents) {
        try {
          await provider.sendLessonReminder(
            {
              telegramChatId: parent.telegramChatId,
              email: parent.user?.email,
              fullName: student.fullName,
            },
            { groupName: lessonName, scheduledAt: session.scheduledAt },
          );
          notifications += 1;
        } catch (err) {
          hadFailure = true;
          recordFailure("lesson-reminder", err instanceof Error ? err.message : String(err));
          log.error("Не удалось отправить напоминание о занятии", err, {
            classSessionId: session.id,
          });
        }
      }
    }

    // Only stamp reminderSentAt once every recipient was reached. A partial
    // failure leaves it null so the next cron run retries the whole session
    // -- some parents may get a duplicate reminder, but that beats the
    // alternative of a session being silently marked "sent" when a delivery
    // actually failed.
    if (hadFailure) {
      failedSessions += 1;
      continue;
    }

    await db.classSession.update({
      where: { id: session.id },
      data: { reminderSentAt: now },
    });
  }

  return NextResponse.json({
    ok: true,
    sessions: sessions.length,
    notifications,
    failedSessions,
  });
});
