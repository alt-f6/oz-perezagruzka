import { describe, expect, it } from "vitest";
import { expandOccurrences } from "./lessonOccurrences";
import type { LessonValues } from "@/crm/lib/schemas";

const BASE: LessonValues = {
  type: "GROUP",
  groupId: "g1",
  date: "2026-09-07", // Monday
  time: "11:00",
  durationMinutes: 60,
  recurrence: "NONE",
  recurrenceDays: [],
};

describe("expandOccurrences with a timezone", () => {
  it("defaults to Moscow when no timezone is given", () => {
    const [occ] = expandOccurrences(BASE);
    expect(occ.scheduledAt.toISOString()).toBe("2026-09-07T08:00:00.000Z");
  });

  it("interprets the entered time in the given zone", () => {
    const [occ] = expandOccurrences(BASE, "Asia/Baku");
    // 11:00 Baku (UTC+4) = 07:00Z, one hour earlier than the Moscow case.
    expect(occ.scheduledAt.toISOString()).toBe("2026-09-07T07:00:00.000Z");
  });

  it("applies the zone to every occurrence of a recurring series, including per-day overrides", () => {
    const values: LessonValues = {
      ...BASE,
      recurrence: "CUSTOM",
      recurrenceDays: [1, 3], // Mon, Wed
      recurrenceEndDate: "2026-09-16",
      daySlots: [{ day: 3, time: "09:00", durationMinutes: 45 }],
    };
    const occurrences = expandOccurrences(values, "Asia/Baku");
    // Monday 11:00 Baku = 07:00Z; Wednesday's override 09:00 Baku = 05:00Z.
    expect(occurrences.map((o) => o.scheduledAt.toISOString())).toEqual([
      "2026-09-07T07:00:00.000Z",
      "2026-09-09T05:00:00.000Z",
      "2026-09-14T07:00:00.000Z",
      "2026-09-16T05:00:00.000Z",
    ]);
  });
});
