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
  it("defaults to 60 when omitted", () => {
    const parsed = lessonSchema.parse(baseValues);
    expect(parsed.durationMinutes).toBe(60);
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
