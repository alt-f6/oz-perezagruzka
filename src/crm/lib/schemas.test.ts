import { describe, expect, it } from "vitest";
import { lessonSchema, lessonListFiltersSchema, bulkCancelWithReasonSchema, reassignTeacherSchema, balanceAdjustmentSchema } from "./schemas";

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
    for (const durationMinutes of [30, 45, 60, 90, 120, 180] as const) {
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

describe("lessonListFiltersSchema", () => {
  it("defaults every field when given an empty object", () => {
    const result = lessonListFiltersSchema.parse({});
    expect(result).toEqual({
      q: "",
      teacherId: undefined,
      format: "ALL",
      status: "ALL",
      range: null,
      from: undefined,
      to: undefined,
      page: 1,
      pageSize: 25,
    });
  });

  it("parses a fully-specified query", () => {
    const result = lessonListFiltersSchema.parse({
      q: "  Иванов  ",
      teacherId: "550e8400-e29b-41d4-a716-446655440000",
      format: "INDIVIDUAL",
      status: "NEEDS_ATTENTION",
      range: "THIS_WEEK",
      from: "2026-03-01",
      to: "2026-03-07",
      page: "2",
      pageSize: "50",
    });
    expect(result.q).toBe("Иванов");
    expect(result.teacherId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.format).toBe("INDIVIDUAL");
    expect(result.status).toBe("NEEDS_ATTENTION");
    expect(result.range).toBe("THIS_WEEK");
    expect(result.from).toBe("2026-03-01");
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(50);
  });

  it("falls back to defaults instead of throwing on garbage input", () => {
    const result = lessonListFiltersSchema.parse({
      teacherId: "not-a-uuid",
      format: "BOGUS",
      status: "BOGUS",
      range: "BOGUS",
      from: "not-a-date",
      page: "-5",
      pageSize: "9999",
    });
    expect(result.teacherId).toBeUndefined();
    expect(result.format).toBe("ALL");
    expect(result.status).toBe("ALL");
    expect(result.range).toBeNull();
    expect(result.from).toBeUndefined();
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it("caps pageSize at 100", () => {
    const result = lessonListFiltersSchema.parse({ pageSize: "100" });
    expect(result.pageSize).toBe(100);
  });
});

describe("bulkCancelWithReasonSchema", () => {
  it("requires at least one session id and a non-trivial reason", () => {
    expect(bulkCancelWithReasonSchema.safeParse({ sessionIds: [], reason: "ok reason" }).success).toBe(false);
    expect(
      bulkCancelWithReasonSchema.safeParse({
        sessionIds: ["550e8400-e29b-41d4-a716-446655440000"],
        reason: "ok reason",
      }).success,
    ).toBe(true);
    expect(
      bulkCancelWithReasonSchema.safeParse({
        sessionIds: ["550e8400-e29b-41d4-a716-446655440000"],
        reason: "no",
      }).success,
    ).toBe(false);
  });
});

describe("reassignTeacherSchema", () => {
  it("requires at least one session id and a valid teacher id", () => {
    expect(
      reassignTeacherSchema.safeParse({
        sessionIds: ["550e8400-e29b-41d4-a716-446655440000"],
        newTeacherId: "550e8400-e29b-41d4-a716-446655440001",
      }).success,
    ).toBe(true);
    expect(reassignTeacherSchema.safeParse({ sessionIds: [], newTeacherId: "x" }).success).toBe(false);
  });
});

describe("balanceAdjustmentSchema", () => {
  it("accepts a positive amount (credit) with no description", () => {
    const result = balanceAdjustmentSchema.safeParse({ amount: 1000, description: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a negative amount (correction) with no description", () => {
    const result = balanceAdjustmentSchema.safeParse({ amount: -500, description: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative amount with a description under 3 characters", () => {
    const result = balanceAdjustmentSchema.safeParse({ amount: -500, description: "ой" });
    expect(result.success).toBe(false);
  });

  it("accepts a negative amount with a description of 3+ characters", () => {
    const result = balanceAdjustmentSchema.safeParse({ amount: -500, description: "ошибка" });
    expect(result.success).toBe(true);
  });

  it("rejects a zero amount", () => {
    const result = balanceAdjustmentSchema.safeParse({ amount: 0, description: "test" });
    expect(result.success).toBe(false);
  });
});
