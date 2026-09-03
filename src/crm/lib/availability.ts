/**
 * Single source of truth for teacher weekly-availability encoding and the
 * scheduling checks that read it.
 *
 * The working window is strictly 07:00–22:00 Europe/Moscow in 1-hour slots:
 * 15 slots per day, 7 days, 105 slots per week. A week's availability is a
 * fixed-length 105-character bitmask string — character N is '1' when the
 * teacher marked that slot as working. Slots are day-major with Monday=0:
 *
 *     index = dayIndex(Mon=0 .. Sun=6) * SLOTS_PER_DAY + (hour - START_HOUR)
 *
 * Everything here is pure and timezone-invariant (it only converts instants to
 * Moscow wall-clock via the shared timezone module), so it is equally usable in
 * server actions, React components, and unit tests.
 */
import { moscowWallClock } from "@/shared/lib/timezone";

export const AVAILABILITY_START_HOUR = 7;
export const AVAILABILITY_END_HOUR = 22;
export const SLOTS_PER_DAY = AVAILABILITY_END_HOUR - AVAILABILITY_START_HOUR; // 15
export const DAYS_PER_WEEK = 7;
export const TOTAL_SLOTS = SLOTS_PER_DAY * DAYS_PER_WEEK; // 105
export const EMPTY_WEEK_SLOTS = "0".repeat(TOTAL_SLOTS);

// Monday-first weekday labels, matching the grid's day ordering (dayIndex 0..6).
export const WEEKDAY_LABELS_MON0 = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const SLOTS_SHAPE = new RegExp(`^[01]{${TOTAL_SLOTS}}$`);

/** The list of slot start-hours, 07..21. */
export function availabilityHours(): number[] {
  return Array.from({ length: SLOTS_PER_DAY }, (_, i) => AVAILABILITY_START_HOUR + i);
}

/** True when `slots` is exactly TOTAL_SLOTS characters of '0'/'1'. */
export function isValidSlots(slots: string): boolean {
  return SLOTS_SHAPE.test(slots);
}

function assertDay(dayIndex: number): void {
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= DAYS_PER_WEEK) {
    throw new RangeError(`dayIndex out of range: ${dayIndex}`);
  }
}

function assertHour(hour: number): void {
  if (
    !Number.isInteger(hour) ||
    hour < AVAILABILITY_START_HOUR ||
    hour >= AVAILABILITY_END_HOUR
  ) {
    throw new RangeError(`hour out of working window: ${hour}`);
  }
}

/** Flat 0..104 index for a (dayIndex Mon=0, start-hour) slot. */
export function slotIndex(dayIndex: number, hour: number): number {
  assertDay(dayIndex);
  assertHour(hour);
  return dayIndex * SLOTS_PER_DAY + (hour - AVAILABILITY_START_HOUR);
}

/** Whether the given slot is marked working. */
export function isSlotOn(slots: string, dayIndex: number, hour: number): boolean {
  return slots.charAt(slotIndex(dayIndex, hour)) === "1";
}

/** Returns a new bitmask with a single slot toggled to `on`. */
export function withSlot(
  slots: string,
  dayIndex: number,
  hour: number,
  on: boolean,
): string {
  const idx = slotIndex(dayIndex, hour);
  return slots.slice(0, idx) + (on ? "1" : "0") + slots.slice(idx + 1);
}

/** Returns a new bitmask with an entire day filled (`on`) or cleared. */
export function setDaySlots(slots: string, dayIndex: number, on: boolean): string {
  let next = slots;
  for (const hour of availabilityHours()) {
    next = withSlot(next, dayIndex, hour, on);
  }
  return next;
}

/** Count of working slots in a week bitmask. */
export function countActiveSlots(slots: string): number {
  let n = 0;
  for (let i = 0; i < slots.length; i++) if (slots.charAt(i) === "1") n++;
  return n;
}

const pad = (n: number) => n.toString().padStart(2, "0");

/** `HH:00–HH:00` label for a slot start-hour, e.g. slotRangeLabel(7) → "07:00–08:00". */
export function slotRangeLabel(hour: number): string {
  return `${pad(hour)}:00–${pad(hour + 1)}:00`;
}

// ─────────────────────────────────────────────────────────────
// Week keys
// ─────────────────────────────────────────────────────────────
//
// A "week key" is the `YYYY-MM-DD` of the week's Monday, interpreted at UTC
// midnight so it round-trips losslessly to the `@db.Date` column and never
// drifts with the server/browser timezone.

/** The Monday (week key) of the week containing the given `YYYY-MM-DD` date key. */
export function weekStartKeyForDateKey(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  const mon0 = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - mon0);
  return d.toISOString().slice(0, 10);
}

/** The week key of the Moscow-calendar week that `instant` falls in. */
export function moscowWeekStartKey(instant: Date | string): string {
  return weekStartKeyForDateKey(moscowWallClock(instant).dateKey);
}

/** Parses a week key to its UTC-midnight Date (for the `@db.Date` column). */
export function weekKeyToDate(weekKey: string): Date {
  return new Date(`${weekKey}T00:00:00.000Z`);
}

/** Serializes a `@db.Date` value back to its week key. */
export function dateToWeekKey(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

/** Advances a week key by `n` whole weeks (may be negative). */
export function addWeeks(weekKey: string, n: number): string {
  const d = weekKeyToDate(weekKey);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────
// Scheduling checks
// ─────────────────────────────────────────────────────────────

/**
 * Whether a teacher whose week bitmask is `slots` has marked *every* hour block
 * a lesson at `scheduledAt` for `durationMinutes` touches as working.
 *
 * The instant is read as Moscow wall-clock, so this is correct regardless of
 * server/browser timezone. A lesson that starts on a :30 boundary or runs long
 * enough to span multiple hours must have all overlapping hour blocks marked;
 * any block outside 07:00–22:00 counts as unavailable.
 */
export function isTeacherAvailableAt(
  slots: string,
  scheduledAt: Date | string,
  durationMinutes: number,
): boolean {
  const { hour, minute, weekdayMon0 } = moscowWallClock(scheduledAt);
  const startMin = hour * 60 + minute;
  const endMin = startMin + durationMinutes;

  // Every hour block [h:00, h+1:00) that the lesson overlaps must be working.
  const firstHour = Math.floor(startMin / 60);
  const lastHour = Math.ceil(endMin / 60) - 1;

  for (let h = firstHour; h <= lastHour; h++) {
    if (h < AVAILABILITY_START_HOUR || h >= AVAILABILITY_END_HOUR) return false;
    if (!isSlotOn(slots, weekdayMon0, h)) return false;
  }
  return true;
}
