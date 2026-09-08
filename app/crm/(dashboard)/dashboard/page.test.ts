import { describe, expect, it } from "vitest";
import { formatUpcomingLessonTime } from "./page";

describe("formatUpcomingLessonTime", () => {
  // 21:30 UTC on Aug 23 is 00:30 Moscow (UTC+3, no DST) on Aug 24 — the day
  // boundary crossing means this only passes if the formatter is pinned to
  // Europe/Moscow, not the server's ambient zone (forced to UTC in tests).
  it("renders the lesson time in Moscow, not the server's ambient TZ", () => {
    const scheduledAt = new Date("2026-08-23T21:30:00.000Z");

    expect(formatUpcomingLessonTime(scheduledAt)).toBe("24.08.2026, 00:30");
  });

  it("does not slip a day when Moscow and ambient UTC agree on the date", () => {
    const scheduledAt = new Date("2026-08-23T09:15:00.000Z");

    expect(formatUpcomingLessonTime(scheduledAt)).toBe("23.08.2026, 12:15");
  });
});
