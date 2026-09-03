import { describe, expect, it } from "vitest";
import {
  BUSINESS_TIMEZONE,
  formatMoscowDate,
  formatMoscowTime,
  localWallClockToMoscowUtc,
  moscowDateKey,
  moscowDateTimeToUtc,
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
