/**
 * DB-facing helpers for teacher weekly availability, kept out of the
 * "use server" action files so they can be shared between the availability
 * actions, the lesson-creation conflict check, and unit tests (which mock
 * `@/shared/lib/db`). Nothing here performs auth — callers (server actions)
 * own RBAC; these functions are pure data access + the availability domain.
 */
import { db } from "@/shared/lib/db";
import {
  dateToWeekKey,
  isTeacherAvailableAt,
  moscowWeekStartKey,
  weekKeyToDate,
} from "@/crm/lib/availability";
import type { Occurrence } from "@/crm/lib/lessonOccurrences";

export interface UnavailableOccurrence {
  scheduledAt: Date;
  durationMinutes: number;
}

export interface BookedConflict {
  scheduledAt: Date;
  durationMinutes: number;
}

/**
 * Loads a teacher's saved slots for a set of week keys, returning a map keyed
 * by week key. Only weeks that actually have a saved row appear in the map — a
 * missing key means the teacher has NOT published availability for that week
 * (distinct from a published-but-all-empty week, which maps to the empty
 * bitmask). Callers decide how to treat "no record" (the grid defaults it to
 * empty for display; the scheduling guard treats it as unrestricted).
 */
export async function getAvailabilityMap(
  teacherId: string,
  weekStarts: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(weekStarts));
  const rows = await db.teacherAvailability.findMany({
    where: {
      teacherId,
      weekStart: { in: unique.map(weekKeyToDate) },
    },
    select: { weekStart: true, slots: true },
  });

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(dateToWeekKey(row.weekStart as Date), row.slots);
  }
  return map;
}

/**
 * Of the given occurrences, returns those that fall on an hour the teacher has
 * NOT marked as working. Availability is opt-in: an occurrence whose week has
 * no published grid is treated as unrestricted (never warned), so lessons for
 * teachers who haven't set up availability behave exactly as before. Only a
 * published week whose slot is off produces a warning.
 */
export async function collectUnavailableOccurrences(
  teacherId: string,
  occurrences: Occurrence[],
): Promise<UnavailableOccurrence[]> {
  if (occurrences.length === 0) return [];

  const weekKeys = occurrences.map((o) => moscowWeekStartKey(o.scheduledAt));
  const map = await getAvailabilityMap(teacherId, weekKeys);
  if (map.size === 0) return [];

  const unavailable: UnavailableOccurrence[] = [];
  for (const occ of occurrences) {
    const slots = map.get(moscowWeekStartKey(occ.scheduledAt));
    if (slots === undefined) continue; // week not published → unrestricted
    if (!isTeacherAvailableAt(slots, occ.scheduledAt, occ.durationMinutes)) {
      unavailable.push({
        scheduledAt: occ.scheduledAt,
        durationMinutes: occ.durationMinutes,
      });
    }
  }
  return unavailable;
}

/**
 * Future scheduled lessons for a teacher in the given Moscow week that would
 * sit OUTSIDE the proposed `newSlots` — i.e. the collision guard for unmarking
 * a slot that already has a booked lesson. Only still-"scheduled" sessions
 * whose start is in the future are considered; past/attended history is never
 * flagged.
 */
export async function findBookedConflictsForWeek(
  teacherId: string,
  weekStart: string,
  newSlots: string,
  now: Date = new Date(),
): Promise<BookedConflict[]> {
  const from = weekKeyToDate(weekStart);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);

  const sessions = await db.classSession.findMany({
    where: {
      teacherId,
      status: "scheduled",
      scheduledAt: { gte: from, lt: to },
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  return sessions
    .filter((s) => new Date(s.scheduledAt) >= now)
    .filter(
      (s) =>
        !isTeacherAvailableAt(newSlots, s.scheduledAt, s.durationMinutes),
    )
    .map((s) => ({
      scheduledAt: new Date(s.scheduledAt),
      durationMinutes: s.durationMinutes,
    }));
}
