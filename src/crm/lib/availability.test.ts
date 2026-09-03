import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_END_HOUR,
  AVAILABILITY_START_HOUR,
  DAYS_PER_WEEK,
  EMPTY_WEEK_SLOTS,
  SLOTS_PER_DAY,
  TOTAL_SLOTS,
  addWeeks,
  availabilityHours,
  countActiveSlots,
  dateToWeekKey,
  isSlotOn,
  isTeacherAvailableAt,
  isValidSlots,
  moscowWeekStartKey,
  setDaySlots,
  slotIndex,
  slotRangeLabel,
  weekKeyToDate,
  weekStartKeyForDateKey,
  withSlot,
} from "./availability";
import { moscowDateTimeToUtc } from "@/shared/lib/timezone";

describe("slot constants", () => {
  it("covers exactly 07:00–22:00 in 1-hour slots (15/day, 105/week)", () => {
    expect(AVAILABILITY_START_HOUR).toBe(7);
    expect(AVAILABILITY_END_HOUR).toBe(22);
    expect(SLOTS_PER_DAY).toBe(15);
    expect(DAYS_PER_WEEK).toBe(7);
    expect(TOTAL_SLOTS).toBe(105);
    expect(EMPTY_WEEK_SLOTS).toHaveLength(105);
    expect(availabilityHours()).toEqual([
      7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    ]);
  });
});

describe("isValidSlots", () => {
  it("accepts a 105-char 0/1 string", () => {
    expect(isValidSlots(EMPTY_WEEK_SLOTS)).toBe(true);
    expect(isValidSlots("1".repeat(105))).toBe(true);
  });
  it("rejects wrong length or invalid chars", () => {
    expect(isValidSlots("0".repeat(104))).toBe(false);
    expect(isValidSlots("0".repeat(106))).toBe(false);
    expect(isValidSlots("2".repeat(105))).toBe(false);
    expect(isValidSlots("0".repeat(104) + "x")).toBe(false);
  });
});

describe("slotIndex", () => {
  it("is day-major: Monday 07:00 is 0, Monday 21:00 is 14, Tuesday 07:00 is 15", () => {
    expect(slotIndex(0, 7)).toBe(0);
    expect(slotIndex(0, 21)).toBe(14);
    expect(slotIndex(1, 7)).toBe(15);
    expect(slotIndex(6, 21)).toBe(104);
  });
  it("throws for out-of-range hours", () => {
    expect(() => slotIndex(0, 6)).toThrow();
    expect(() => slotIndex(0, 22)).toThrow();
    expect(() => slotIndex(7, 7)).toThrow();
  });
});

describe("withSlot / isSlotOn / setDaySlots / countActiveSlots", () => {
  it("toggles a single slot immutably", () => {
    const next = withSlot(EMPTY_WEEK_SLOTS, 2, 10, true);
    expect(isSlotOn(next, 2, 10)).toBe(true);
    expect(isSlotOn(next, 2, 11)).toBe(false);
    expect(countActiveSlots(next)).toBe(1);
    // original untouched
    expect(countActiveSlots(EMPTY_WEEK_SLOTS)).toBe(0);
  });
  it("fills and clears a whole day", () => {
    const filled = setDaySlots(EMPTY_WEEK_SLOTS, 3, true);
    expect(countActiveSlots(filled)).toBe(15);
    for (const h of availabilityHours()) expect(isSlotOn(filled, 3, h)).toBe(true);
    const cleared = setDaySlots(filled, 3, false);
    expect(countActiveSlots(cleared)).toBe(0);
  });
});

describe("slotRangeLabel", () => {
  it("renders an hour range", () => {
    expect(slotRangeLabel(7)).toBe("07:00–08:00");
    expect(slotRangeLabel(21)).toBe("21:00–22:00");
  });
});

describe("week keys", () => {
  it("weekStartKeyForDateKey returns the Monday of that week", () => {
    // 2026-09-03 is a Thursday → Monday is 2026-08-31.
    expect(weekStartKeyForDateKey("2026-09-03")).toBe("2026-08-31");
    // Monday maps to itself.
    expect(weekStartKeyForDateKey("2026-08-31")).toBe("2026-08-31");
    // Sunday maps back to the same week's Monday.
    expect(weekStartKeyForDateKey("2026-09-06")).toBe("2026-08-31");
  });
  it("weekKeyToDate <-> dateToWeekKey round-trips at UTC midnight", () => {
    const d = weekKeyToDate("2026-08-31");
    expect(d.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(dateToWeekKey(d)).toBe("2026-08-31");
  });
  it("addWeeks advances by 7-day steps", () => {
    expect(addWeeks("2026-08-31", 1)).toBe("2026-09-07");
    expect(addWeeks("2026-08-31", -1)).toBe("2026-08-24");
    expect(addWeeks("2026-08-31", 2)).toBe("2026-09-14");
  });
  it("moscowWeekStartKey uses the Moscow calendar day of an instant", () => {
    // 2026-09-06 23:00 Moscow = 2026-09-06T20:00Z, still Sunday in Moscow →
    // week Monday is 2026-08-31.
    const instant = moscowDateTimeToUtc("2026-09-06", "23:00");
    expect(moscowWeekStartKey(instant)).toBe("2026-08-31");
  });
});

describe("isTeacherAvailableAt", () => {
  // Monday 2026-08-31, mark 15:00 and 16:00 as working.
  const monday = "2026-08-31";
  let slots = EMPTY_WEEK_SLOTS;
  slots = withSlot(slots, 0, 15, true);
  slots = withSlot(slots, 0, 16, true);

  it("returns true when a 60-min lesson lands fully in a working slot", () => {
    const at = moscowDateTimeToUtc(monday, "15:00");
    expect(isTeacherAvailableAt(slots, at, 60)).toBe(true);
  });

  it("returns true when a 90-min lesson spans two consecutive working slots", () => {
    const at = moscowDateTimeToUtc(monday, "15:00");
    // 15:00–16:30 covers the 15:00 and 16:00 hour blocks, both on.
    expect(isTeacherAvailableAt(slots, at, 90)).toBe(true);
  });

  it("returns false when part of the lesson falls in an unmarked slot", () => {
    const at = moscowDateTimeToUtc(monday, "16:00");
    // 16:00–17:30 covers 16:00 (on) and 17:00 (off).
    expect(isTeacherAvailableAt(slots, at, 90)).toBe(false);
  });

  it("returns false when the slot is not marked at all", () => {
    const at = moscowDateTimeToUtc(monday, "10:00");
    expect(isTeacherAvailableAt(slots, at, 60)).toBe(false);
  });

  it("returns false for a lesson outside the 07:00–22:00 window", () => {
    let s = withSlot(EMPTY_WEEK_SLOTS, 0, 21, true);
    const at = moscowDateTimeToUtc(monday, "21:30");
    // 21:30–22:30 pokes past 22:00 into a non-existent slot.
    expect(isTeacherAvailableAt(s, at, 60)).toBe(false);
    s = withSlot(EMPTY_WEEK_SLOTS, 0, 7, true);
    const early = moscowDateTimeToUtc(monday, "06:30");
    expect(isTeacherAvailableAt(s, early, 60)).toBe(false);
  });

  it("keys off the correct Moscow weekday for a late-evening instant", () => {
    // A Sunday 21:00 MSK slot marked; verify a Sunday-evening lesson matches it.
    const sundaySlots = withSlot(EMPTY_WEEK_SLOTS, 6, 21, true);
    const at = moscowDateTimeToUtc("2026-09-06", "21:00"); // Sunday
    expect(isTeacherAvailableAt(sundaySlots, at, 60)).toBe(true);
  });
});
