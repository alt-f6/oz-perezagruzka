import { BUSINESS_TIMEZONE } from "@/shared/lib/timezone";

export interface TimedSession {
  scheduledAt: Date | string;
  durationMinutes: number;
}

export function getSessionEndsAt(session: TimedSession): Date {
  const start = new Date(session.scheduledAt);
  return new Date(start.getTime() + session.durationMinutes * 60_000);
}

// Pinned to the business timezone (Europe/Moscow) so a stored instant always
// renders as the Moscow wall-clock the operator picked, regardless of the
// server's or browser's ambient timezone. Without an explicit `timeZone` this
// floated on the runtime zone and drifted (TIME-02).
const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTimeRange(session: TimedSession): string {
  const start = new Date(session.scheduledAt);
  const end = getSessionEndsAt(session);
  return `${timeFormatter.format(start)}–${timeFormatter.format(end)} (${session.durationMinutes} мин)`;
}

/**
 * A lesson is only "concluded" once it has actually finished (start +
 * duration) -- attendance/grading/homework are routine journal work done
 * during or right after the lesson, so a start-time boundary would remove a
 * TEACHER's ability to record any of that for the lesson they're currently
 * teaching. Every past-lesson guard and attendance-status classification
 * must use this, never a bare `scheduledAt < now` check.
 */
export function isLessonConcluded(session: TimedSession, now: Date = new Date()): boolean {
  return getSessionEndsAt(session).getTime() <= now.getTime();
}
