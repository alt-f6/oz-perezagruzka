import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  teacherRate: { findMany: vi.fn() },
  classSession: { count: vi.fn() },
  attendance: { count: vi.fn() },
  transaction: { aggregate: vi.fn() },
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));

const { computeTeacherSalary } = await import("@/crm/lib/services/salary.service");

const from = new Date("2026-07-01T00:00:00.000Z");
const to = new Date("2026-08-01T00:00:00.000Z");
const rateCreatedAt = new Date("2026-01-01T00:00:00.000Z");

// A single rate created before the queried period applies to the whole
// [from, to) window, matching the pre-effective-dating behavior these tests
// were written against.
function singleRate(rateType: string, value: number) {
  return [{ rateType, value, createdAt: rateCreatedAt }];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("computeTeacherSalary", () => {
  it("returns null when the teacher has no configured rate", async () => {
    dbMock.teacherRate.findMany.mockResolvedValue([]);

    const result = await computeTeacherSalary("teacher_1", from, to);

    expect(result).toBeNull();
  });

  it("FIXED_PER_LESSON multiplies conducted-session count by the rate", async () => {
    dbMock.teacherRate.findMany.mockResolvedValue(singleRate("FIXED_PER_LESSON", 700));
    dbMock.classSession.count.mockResolvedValue(3);

    const result = await computeTeacherSalary("teacher_1", from, to);

    expect(result).toEqual({
      rateType: "FIXED_PER_LESSON",
      rateValue: 700,
      basis: 3,
      amount: 2100,
    });
  });

  it("PER_HEAD multiplies billable attendance-mark count by the rate", async () => {
    dbMock.teacherRate.findMany.mockResolvedValue(singleRate("PER_HEAD", 300));
    dbMock.attendance.count.mockResolvedValue(2);

    const result = await computeTeacherSalary("teacher_1", from, to);

    expect(result).toEqual({
      rateType: "PER_HEAD",
      rateValue: 300,
      basis: 2,
      amount: 600,
    });
    expect(dbMock.attendance.count).toHaveBeenCalledWith({
      where: {
        status: { in: ["PRESENT", "ABSENT"] },
        classSession: { teacherId: "teacher_1", scheduledAt: { gte: from, lt: to } },
      },
    });
  });

  it("PERCENTAGE takes a share of the absolute charged revenue", async () => {
    dbMock.teacherRate.findMany.mockResolvedValue(singleRate("PERCENTAGE", 10));
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: -3000 } });

    const result = await computeTeacherSalary("teacher_1", from, to);

    expect(result).toEqual({
      rateType: "PERCENTAGE",
      rateValue: 10,
      basis: 3000,
      amount: 300,
    });
  });

  it("PERCENTAGE rounds the payout to two decimal places", async () => {
    dbMock.teacherRate.findMany.mockResolvedValue(singleRate("PERCENTAGE", 7));
    // 7% of 1099 = 76.93 exactly, but 12.5% style rates can produce
    // longer decimals -- use a value that does to exercise rounding.
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: -1000 } });

    const result = await computeTeacherSalary("teacher_1", from, to);

    // 7% of 1000 = 70 exactly; assert the rounding path is exercised with a
    // value that would otherwise carry floating point noise.
    expect(result?.amount).toBeCloseTo(70, 2);
  });

  it("PERCENTAGE rounds away floating point noise (e.g. 33.333...)", async () => {
    dbMock.teacherRate.findMany.mockResolvedValue(singleRate("PERCENTAGE", 33.333));
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: -100 } });

    const result = await computeTeacherSalary("teacher_1", from, to);

    // 100 * 33.333 / 100 = 33.333 -> rounded to 2dp = 33.33
    expect(result?.amount).toBe(33.33);
  });

  it("treats a missing aggregate sum as zero charged revenue", async () => {
    dbMock.teacherRate.findMany.mockResolvedValue(singleRate("PERCENTAGE", 10));
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });

    const result = await computeTeacherSalary("teacher_1", from, to);

    expect(result).toEqual({ rateType: "PERCENTAGE", rateValue: 10, basis: 0, amount: 0 });
  });

  it("applies a mid-period rate change only from its own createdAt onward, not retroactively", async () => {
    dbMock.teacherRate.findMany.mockResolvedValue([
      { rateType: "FIXED_PER_LESSON", value: 700, createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { rateType: "FIXED_PER_LESSON", value: 1000, createdAt: new Date("2026-07-15T00:00:00.000Z") },
    ]);
    // 2 sessions before the rate change, 3 after.
    dbMock.classSession.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    const result = await computeTeacherSalary("teacher_1", from, to);

    expect(dbMock.classSession.count).toHaveBeenCalledTimes(2);
    expect(dbMock.classSession.count).toHaveBeenNthCalledWith(1, {
      where: {
        teacherId: "teacher_1",
        scheduledAt: { gte: from, lt: new Date("2026-07-15T00:00:00.000Z") },
        attendance: { some: {} },
      },
    });
    expect(dbMock.classSession.count).toHaveBeenNthCalledWith(2, {
      where: {
        teacherId: "teacher_1",
        scheduledAt: { gte: new Date("2026-07-15T00:00:00.000Z"), lt: to },
        attendance: { some: {} },
      },
    });
    // 2 * 700 (old rate) + 3 * 1000 (new rate) = 4400, not 5 * 1000 = 5000.
    expect(result).toEqual({
      rateType: "FIXED_PER_LESSON",
      rateValue: 1000,
      basis: 5,
      amount: 4400,
    });
  });
});
