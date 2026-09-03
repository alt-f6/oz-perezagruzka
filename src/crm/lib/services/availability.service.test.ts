import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  teacherAvailability: { findMany: vi.fn() },
  classSession: { findMany: vi.fn() },
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));

const {
  getAvailabilityMap,
  collectUnavailableOccurrences,
  findBookedConflictsForWeek,
} = await import("@/crm/lib/services/availability.service");
const { EMPTY_WEEK_SLOTS, withSlot, weekKeyToDate } = await import(
  "@/crm/lib/availability"
);
const { moscowDateTimeToUtc } = await import("@/shared/lib/timezone");

beforeEach(() => {
  vi.clearAllMocks();
});

// Monday 2026-08-31 with 15:00 marked working.
const MONDAY = "2026-08-31";
const slots1500 = withSlot(EMPTY_WEEK_SLOTS, 0, 15, true);

describe("getAvailabilityMap", () => {
  it("maps only weeks that have a saved row (missing weeks are absent)", async () => {
    dbMock.teacherAvailability.findMany.mockResolvedValue([
      { weekStart: weekKeyToDate(MONDAY), slots: slots1500 },
    ]);

    const map = await getAvailabilityMap("t1", [MONDAY, "2026-09-07"]);

    expect(map.get(MONDAY)).toBe(slots1500);
    // No published grid for the second week → not in the map (unrestricted).
    expect(map.has("2026-09-07")).toBe(false);
  });
});

describe("collectUnavailableOccurrences", () => {
  it("returns only occurrences outside declared working hours", async () => {
    dbMock.teacherAvailability.findMany.mockResolvedValue([
      { weekStart: weekKeyToDate(MONDAY), slots: slots1500 },
    ]);

    const occurrences = [
      { scheduledAt: moscowDateTimeToUtc(MONDAY, "15:00"), durationMinutes: 60 }, // available
      { scheduledAt: moscowDateTimeToUtc(MONDAY, "10:00"), durationMinutes: 60 }, // NOT available
    ];

    const result = await collectUnavailableOccurrences("t1", occurrences);

    expect(result).toHaveLength(1);
    expect(result[0].scheduledAt.toISOString()).toBe(
      moscowDateTimeToUtc(MONDAY, "10:00").toISOString(),
    );
  });

  it("is empty when there are no occurrences (no DB call)", async () => {
    const result = await collectUnavailableOccurrences("t1", []);
    expect(result).toEqual([]);
    expect(dbMock.teacherAvailability.findMany).not.toHaveBeenCalled();
  });

  it("never warns when the teacher has not published any grid (opt-in)", async () => {
    dbMock.teacherAvailability.findMany.mockResolvedValue([]);

    const result = await collectUnavailableOccurrences("t1", [
      { scheduledAt: moscowDateTimeToUtc(MONDAY, "10:00"), durationMinutes: 60 },
    ]);

    expect(result).toEqual([]);
  });
});

describe("findBookedConflictsForWeek", () => {
  const now = moscowDateTimeToUtc(MONDAY, "00:00");

  it("flags a future scheduled lesson that sits outside the new slots", async () => {
    dbMock.classSession.findMany.mockResolvedValue([
      { scheduledAt: moscowDateTimeToUtc(MONDAY, "10:00"), durationMinutes: 60 },
    ]);

    // New grid only marks 15:00 → the 10:00 lesson is now a conflict.
    const conflicts = await findBookedConflictsForWeek("t1", MONDAY, slots1500, now);

    expect(conflicts).toHaveLength(1);
  });

  it("does not flag a lesson still inside the new slots", async () => {
    dbMock.classSession.findMany.mockResolvedValue([
      { scheduledAt: moscowDateTimeToUtc(MONDAY, "15:00"), durationMinutes: 60 },
    ]);

    const conflicts = await findBookedConflictsForWeek("t1", MONDAY, slots1500, now);

    expect(conflicts).toHaveLength(0);
  });

  it("ignores past lessons even if outside the new slots", async () => {
    dbMock.classSession.findMany.mockResolvedValue([
      { scheduledAt: moscowDateTimeToUtc(MONDAY, "10:00"), durationMinutes: 60 },
    ]);

    // now is AFTER the lesson → it is history, not a conflict.
    const later = moscowDateTimeToUtc(MONDAY, "12:00");
    const conflicts = await findBookedConflictsForWeek("t1", MONDAY, slots1500, later);

    expect(conflicts).toHaveLength(0);
  });
});
