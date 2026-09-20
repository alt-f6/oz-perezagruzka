import { describe, expect, it } from "vitest";
import {
  BUSINESS_TIMEZONE,
  formatMoscowDate,
  formatMoscowDateTime,
  formatMoscowTime,
  localWallClockToMoscowUtc,
  moscowDateKey,
  moscowDateTimeToUtc,
  moscowStartOfDay,
  moscowStartOfNextDay,
  moscowStartOfWeek,
  moscowStartOfNextWeek,
  addMoscowDays,
  moscowWallClock,
  zonedWallClockToUtc,
} from "./timezone";

describe("moscowDateTimeToUtc", () => {
  it("maps an 11:00 Moscow wall-clock to 08:00Z (TIME-02: no +3h drift)", () => {
    const utc = moscowDateTimeToUtc("2026-09-06", "11:00");
    expect(utc.toISOString()).toBe("2026-09-06T08:00:00.000Z");
  });

  it("keeps the calendar day stable for a midday selection (TIME-01)", () => {
    const utc = moscowDateTimeToUtc("2026-09-01", "12:00");
    // 12:00 Moscow = 09:00Z, still the 1st in both Moscow and UTC.
    expect(moscowDateKey(utc)).toBe("2026-09-01");
    expect(formatMoscowDate(utc)).toBe("01.09.2026");
  });

  it("renders the same wall-clock it was given (round-trip)", () => {
    const utc = moscowDateTimeToUtc("2026-08-31", "09:00");
    expect(formatMoscowTime(utc)).toBe("09:00");
    expect(formatMoscowDate(utc)).toBe("31.08.2026");
  });

  it("preserves the Moscow day for a late-evening slot near midnight", () => {
    // 23:00 Moscow on the 1st = 20:00Z on the 1st; the Moscow key must stay 01.
    const utc = moscowDateTimeToUtc("2026-09-01", "23:00");
    expect(utc.toISOString()).toBe("2026-09-01T20:00:00.000Z");
    expect(moscowDateKey(utc)).toBe("2026-09-01");
    expect(formatMoscowTime(utc)).toBe("23:00");
  });
});

describe("zonedWallClockToUtc", () => {
  it("uses a 1-based month", () => {
    // January (month=1), not month=0.
    const jan = zonedWallClockToUtc(2026, 1, 15, 10, 0, BUSINESS_TIMEZONE);
    expect(jan.toISOString()).toBe("2026-01-15T07:00:00.000Z");
  });
});

describe("localWallClockToMoscowUtc", () => {
  it("reads a Date's local calendar fields as Moscow wall-clock", () => {
    // Constructed via the local Date constructor the CRM uses (parseDateKey +
    // setHours-style). Under any server TZ its local fields read 2026-09-07 15:00.
    const local = new Date(2026, 8, 7, 15, 0, 0, 0);
    const utc = localWallClockToMoscowUtc(local);
    expect(formatMoscowTime(utc)).toBe("15:00");
    expect(formatMoscowDate(utc)).toBe("07.09.2026");
  });
});

describe("moscowStartOfDay", () => {
  it("returns the MSK midnight (UTC+3) that contains the given instant", () => {
    // 2026-03-10T05:00:00Z = 08:00 MSK on 2026-03-10; MSK midnight that day is 21:00 UTC the day before.
    const result = moscowStartOfDay(new Date("2026-03-10T05:00:00.000Z"));
    expect(result.toISOString()).toBe("2026-03-09T21:00:00.000Z");
  });

  it("is idempotent when given an instant that is already MSK midnight", () => {
    const start = moscowStartOfDay(new Date("2026-03-09T21:00:00.000Z"));
    expect(moscowStartOfDay(start).toISOString()).toBe(start.toISOString());
  });
});

describe("moscowStartOfNextDay", () => {
  it("is exactly 24 hours after moscowStartOfDay for the same instant", () => {
    const instant = new Date("2026-03-10T05:00:00.000Z");
    const diff = moscowStartOfNextDay(instant).getTime() - moscowStartOfDay(instant).getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });
});

describe("moscowStartOfWeek", () => {
  it("lands on a Moscow Monday at 00:00", () => {
    const result = moscowStartOfWeek(new Date("2026-03-12T10:00:00.000Z"));
    const wallClock = moscowWallClock(result);
    expect(wallClock.weekdayMon0).toBe(0);
    expect(wallClock.hour).toBe(0);
    expect(wallClock.minute).toBe(0);
  });

  it("returns the same Monday for any instant later in that Moscow week", () => {
    const weekStart = moscowStartOfWeek(new Date("2026-03-12T10:00:00.000Z"));
    const laterSameWeek = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000 + 1000);
    expect(moscowStartOfWeek(laterSameWeek).toISOString()).toBe(weekStart.toISOString());
  });

  it("never resolves to the instant that starts the following week", () => {
    const instant = new Date("2026-03-12T10:00:00.000Z");
    const nextWeekStart = moscowStartOfNextWeek(instant);
    expect(moscowStartOfWeek(nextWeekStart).toISOString()).toBe(nextWeekStart.toISOString());
  });
});

describe("moscowStartOfNextWeek", () => {
  it("is exactly 7 days after moscowStartOfWeek for the same instant", () => {
    const instant = new Date("2026-03-12T10:00:00.000Z");
    const diff = moscowStartOfNextWeek(instant).getTime() - moscowStartOfWeek(instant).getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("addMoscowDays", () => {
  it("shifts an instant forward by whole 24h days", () => {
    const instant = new Date("2026-03-10T05:00:00.000Z");
    expect(addMoscowDays(instant, 1).toISOString()).toBe("2026-03-11T05:00:00.000Z");
  });

  it("supports negative offsets", () => {
    const instant = new Date("2026-03-10T05:00:00.000Z");
    expect(addMoscowDays(instant, -2).toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });
});

describe("formatMoscowDateTime", () => {
  it("composes formatMoscowDate and formatMoscowTime with a comma separator", () => {
    const utc = moscowDateTimeToUtc("2026-09-06", "14:30");
    expect(formatMoscowDateTime(utc)).toBe(`${formatMoscowDate(utc)}, ${formatMoscowTime(utc)}`);
  });

  it("matches the DD.MM.YYYY, HH:mm shape", () => {
    const utc = moscowDateTimeToUtc("2026-09-06", "14:30");
    expect(formatMoscowDateTime(utc)).toMatch(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
  });
});
