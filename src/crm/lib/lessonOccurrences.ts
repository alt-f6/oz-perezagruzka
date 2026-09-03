/**
 * Pure expansion of a lesson-creation request into its concrete occurrences.
 *
 * Extracted from the createLesson server action so the same logic can back both
 * the authoritative create path and the client-facing availability preview
 * (which must expand the exact same instants the create would persist). Kept
 * free of any "use server"/DB dependency so it is trivially unit-testable and
 * importable from either side.
 */
import { parseDateKey } from "@/crm/lib/calendarGrid";
import { zonedWallClockToUtc } from "@/shared/lib/timezone";
import type { LessonValues } from "@/crm/lib/schemas";

export const MAX_RECURRING_SESSIONS = 200;

export interface Occurrence {
  scheduledAt: Date;
  durationMinutes: number;
}

/**
 * Resolves the start time + duration for a given weekday: its own per-day slot
 * override when present, otherwise the top-level default.
 */
function resolveSlot(
  values: LessonValues,
  weekday: number,
): { time: string; durationMinutes: number } {
  const slot = values.daySlots?.find((s) => s.day === weekday);
  if (slot) {
    return { time: slot.time, durationMinutes: slot.durationMinutes };
  }
  return { time: values.time, durationMinutes: values.durationMinutes };
}

/**
 * Combines a calendar day (whose LOCAL fields carry the intended date, as
 * produced by parseDateKey + the recurrence cursor) with an `HH:MM` wall-clock,
 * interpreting the result as Europe/Moscow and returning the matching UTC
 * instant. Using the explicit business timezone here — instead of the ambient
 * `setHours` — is what makes the persisted instant render back as the exact
 * wall-clock the operator picked, on any server/browser timezone (TIME-01/02).
 */
function atTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return zonedWallClockToUtc(
    day.getFullYear(),
    day.getMonth() + 1,
    day.getDate(),
    hours,
    minutes,
  );
}

/**
 * Expands a recurring-lesson request into every occurrence, honoring per-day
 * time/duration overrides, capped at MAX_RECURRING_SESSIONS as a backstop.
 */
export function expandOccurrences(values: LessonValues): Occurrence[] {
  const start = parseDateKey(values.date);

  if (values.recurrence === "NONE") {
    return [
      {
        scheduledAt: atTime(start, values.time),
        durationMinutes: values.durationMinutes,
      },
    ];
  }

  const endDate = parseDateKey(values.recurrenceEndDate as string);
  endDate.setHours(23, 59, 59, 999);

  const allowedDays =
    values.recurrence === "WEEKDAYS"
      ? new Set([1, 2, 3, 4, 5])
      : values.recurrence === "WEEKLY"
        ? new Set([start.getDay()])
        : new Set(values.recurrenceDays ?? []);

  const occurrences: Occurrence[] = [];
  const cursor = new Date(start);
  while (cursor <= endDate && occurrences.length < MAX_RECURRING_SESSIONS) {
    if (allowedDays.has(cursor.getDay())) {
      const { time, durationMinutes } = resolveSlot(values, cursor.getDay());
      occurrences.push({
        scheduledAt: atTime(cursor, time),
        durationMinutes,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences;
}
