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

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// External trigger (Vercel Cron / systemd timer): sends Telegram reminders to
// the parents of every student whose group has a class in the next 24 hours.
// `ClassSession.reminderSentAt` guards against duplicate sends across runs.
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

  const sessions = await db.classSession.findMany({
    where: {
      scheduledAt: { gte: now, lte: windowEnd },
      reminderSentAt: null,
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
    },
    take: 200,
  });

  const provider = getNotificationProvider();
  let notifications = 0;
  let failedSessions = 0;

  for (const session of sessions) {
    let hadFailure = false;

    for (const { student } of session.group.students) {
      if (student.deletedAt) continue;
      for (const { parent } of student.parents) {
        try {
          await provider.sendLessonReminder(
            {
              telegramChatId: parent.telegramChatId,
              email: parent.user?.email,
              fullName: student.fullName,
            },
            { groupName: session.group.name, scheduledAt: session.scheduledAt },
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
