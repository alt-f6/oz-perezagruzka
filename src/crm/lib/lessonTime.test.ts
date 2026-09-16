import { describe, expect, it } from "vitest";
import { formatTimeRange, getSessionEndsAt, isAttendanceWindowOpen, isLessonConcluded } from "./lessonTime";

describe("getSessionEndsAt", () => {
  it("adds durationMinutes to scheduledAt", () => {
    const end = getSessionEndsAt({
      scheduledAt: new Date("2026-08-23T15:00:00.000Z"),
      durationMinutes: 60,
    });
    expect(end.toISOString()).toBe("2026-08-23T16:00:00.000Z");
  });

  it("accepts a string scheduledAt", () => {
    const end = getSessionEndsAt({
      scheduledAt: "2026-08-23T15:00:00.000Z",
      durationMinutes: 90,
    });
    expect(end.toISOString()).toBe("2026-08-23T16:30:00.000Z");
  });
});

describe("formatTimeRange", () => {
  // Inputs are UTC instants; the range renders in Europe/Moscow (UTC+3), so a
  // 15:00Z instant is the 18:00 Moscow wall-clock. This is deterministic
  // regardless of the machine's ambient timezone.
  it("formats a start-end range with the duration in minutes (Moscow wall-clock)", () => {
    const text = formatTimeRange({
      scheduledAt: new Date("2026-08-23T15:00:00.000Z"),
      durationMinutes: 60,
    });
    expect(text).toBe("18:00–19:00 (60 мин)");
  });

  it("handles a 30-minute session", () => {
    const text = formatTimeRange({
      scheduledAt: new Date("2026-08-23T09:15:00.000Z"),
      durationMinutes: 30,
    });
    expect(text).toBe("12:15–12:45 (30 мин)");
  });
});

describe("isLessonConcluded", () => {
  it("is false while the lesson is still in progress", () => {
    const now = new Date("2026-03-10T10:30:00.000Z");
    const session = { scheduledAt: new Date("2026-03-10T10:00:00.000Z"), durationMinutes: 60 };
    expect(isLessonConcluded(session, now)).toBe(false);
  });

  it("is true exactly at the scheduled end instant", () => {
    const session = { scheduledAt: new Date("2026-03-10T10:00:00.000Z"), durationMinutes: 60 };
    const now = new Date("2026-03-10T11:00:00.000Z");
    expect(isLessonConcluded(session, now)).toBe(true);
  });

  it("is true well after the lesson ended", () => {
    const session = { scheduledAt: new Date("2026-03-10T10:00:00.000Z"), durationMinutes: 60 };
    const now = new Date("2026-03-11T00:00:00.000Z");
    expect(isLessonConcluded(session, now)).toBe(true);
  });

  it("defaults `now` to the current instant when omitted", () => {
    const farFuture = { scheduledAt: new Date(Date.now() + 60_000), durationMinutes: 30 };
    expect(isLessonConcluded(farFuture)).toBe(false);
  });
});

describe("isAttendanceWindowOpen", () => {
  it("is false more than 15 minutes before the scheduled start", () => {
    const now = new Date("2026-03-10T09:44:00.000Z");
    const session = { scheduledAt: new Date("2026-03-10T10:00:00.000Z") };
    expect(isAttendanceWindowOpen(session, now)).toBe(false);
  });

  it("is true exactly at the 15-minute pre-lesson boundary", () => {
    const now = new Date("2026-03-10T09:45:00.000Z");
    const session = { scheduledAt: new Date("2026-03-10T10:00:00.000Z") };
    expect(isAttendanceWindowOpen(session, now)).toBe(true);
  });

  it("is true at the scheduled start and any time after", () => {
    const session = { scheduledAt: new Date("2026-03-10T10:00:00.000Z") };
    expect(isAttendanceWindowOpen(session, new Date("2026-03-10T10:00:00.000Z"))).toBe(true);
    expect(isAttendanceWindowOpen(session, new Date("2026-03-11T00:00:00.000Z"))).toBe(true);
  });

  it("defaults `now` to the current instant when omitted", () => {
    const soon = { scheduledAt: new Date(Date.now() + 5 * 60_000) };
    expect(isAttendanceWindowOpen(soon)).toBe(true);
    const distant = { scheduledAt: new Date(Date.now() + 60 * 60_000) };
    expect(isAttendanceWindowOpen(distant)).toBe(false);
  });
});
