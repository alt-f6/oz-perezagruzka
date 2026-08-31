import { describe, expect, it } from "vitest";
import { lessonSchema } from "./schemas";

const baseValues = {
  groupId: "b6f8f9d4-6f1a-4e2a-9b8a-0a1b2c3d4e5f",
  date: "2026-09-01",
  time: "15:00",
  recurrence: "NONE" as const,
  recurrenceDays: [],
  recurrenceEndDate: "",
};

describe("lessonSchema durationMinutes", () => {
  it("is required — rejects a payload that omits it", () => {
    const result = lessonSchema.safeParse(baseValues);
    expect(result.success).toBe(false);
  });

  it("accepts each allowed chip value", () => {
    for (const durationMinutes of [30, 45, 60, 90, 120] as const) {
      const parsed = lessonSchema.parse({ ...baseValues, durationMinutes });
      expect(parsed.durationMinutes).toBe(durationMinutes);
    }
  });

  it("rejects a duration outside the allowed set", () => {
    const result = lessonSchema.safeParse({ ...baseValues, durationMinutes: 40 });
    expect(result.success).toBe(false);
  });
});

describe("lessonSchema daySlots (per-day time slots)", () => {
  const customBase = {
    ...baseValues,
    durationMinutes: 60 as const,
    recurrence: "CUSTOM" as const,
    recurrenceDays: [1, 6],
    recurrenceEndDate: "2026-09-30",
  };

  it("accepts independent time/duration per selected weekday", () => {
    const parsed = lessonSchema.parse({
      ...customBase,
      daySlots: [
        { day: 1, time: "15:00", durationMinutes: 60 },
        { day: 6, time: "10:00", durationMinutes: 90 },
      ],
    });
    expect(parsed.daySlots).toHaveLength(2);
    expect(parsed.daySlots?.find((s) => s.day === 6)?.durationMinutes).toBe(90);
  });

  it("allows omitting daySlots — the default time covers every day", () => {
    const result = lessonSchema.safeParse({ ...customBase, daySlots: [] });
    expect(result.success).toBe(true);
  });

  it("rejects a daySlot with an invalid duration", () => {
    const result = lessonSchema.safeParse({
      ...customBase,
      daySlots: [{ day: 1, time: "15:00", durationMinutes: 40 }],
    });
    expect(result.success).toBe(false);
  });
});
