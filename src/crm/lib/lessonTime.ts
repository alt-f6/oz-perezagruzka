export interface TimedSession {
  scheduledAt: Date | string;
  durationMinutes: number;
}

export function getSessionEndsAt(session: TimedSession): Date {
  const start = new Date(session.scheduledAt);
  return new Date(start.getTime() + session.durationMinutes * 60_000);
}

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTimeRange(session: TimedSession): string {
  const start = new Date(session.scheduledAt);
  const end = getSessionEndsAt(session);
  return `${timeFormatter.format(start)}–${timeFormatter.format(end)} (${session.durationMinutes} мин)`;
}
