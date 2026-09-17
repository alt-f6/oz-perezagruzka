import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = vi.hoisted(() => ({
  transaction: { aggregate: vi.fn(), findMany: vi.fn() },
  groupStudent: { findMany: vi.fn() },
  classSession: { findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));

const {
  computeAbonementSummary,
  computeMinGroupRemainingLessons,
  remainingLessonsFor,
} = await import("./abonement.service");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("remainingLessonsFor", () => {
  it("floors balance/price", () => {
    expect(remainingLessonsFor(1000, 500)).toBe(2);
    expect(remainingLessonsFor(999, 500)).toBe(1);
  });

  it("returns null when price is zero or negative", () => {
    expect(remainingLessonsFor(1000, 0)).toBeNull();
    expect(remainingLessonsFor(1000, -100)).toBeNull();
  });

  it("never returns a negative count for a negative balance", () => {
    expect(remainingLessonsFor(-500, 500)).toBe(0);
  });
});

describe("getLastIndividualLessonPrice", () => {
  it("returns the price of the most recent non-trial individual session", async () => {
    dbMock.classSession.findFirst.mockResolvedValue({ pricePerLesson: 1500 });
    const { getLastIndividualLessonPrice } = await import("./abonement.service");

    const result = await getLastIndividualLessonPrice("student_1");

    expect(result).toBe(1500);
    expect(dbMock.classSession.findFirst).toHaveBeenCalledWith({
      where: { studentId: "student_1", type: "INDIVIDUAL", pricePerLesson: { not: null }, isTrial: false },
      orderBy: { scheduledAt: "desc" },
      select: { pricePerLesson: true },
    });
  });

  it("returns null when the student has no individual lesson history", async () => {
    dbMock.classSession.findFirst.mockResolvedValue(null);
    const { getLastIndividualLessonPrice } = await import("./abonement.service");

    const result = await getLastIndividualLessonPrice("student_1");

    expect(result).toBeNull();
  });
});

describe("computeMinGroupRemainingLessons", () => {
  it("returns the lowest figure across groups against the SAME shared balance (not split)", () => {
    // 1000₽ shared balance: group A costs 500 (2 left), group B costs 1000 (1 left).
    // Both are computed against the full 1000, never divided between groups.
    const result = computeMinGroupRemainingLessons(1000, [
      { pricePerLesson: 500 },
      { pricePerLesson: 1000 },
    ]);
    expect(result).toBe(1);
  });

  it("ignores groups with an unset price and returns null if none are usable", () => {
    expect(computeMinGroupRemainingLessons(1000, [{ pricePerLesson: 0 }])).toBeNull();
  });
});

describe("computeAbonementSummary", () => {
  it("SINGLE_GROUP: floors balance/price for the student's one group", async () => {
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 1500 } });
    dbMock.groupStudent.findMany.mockResolvedValue([
      { group: { id: "g1", name: "Математика ОГЭ", pricePerLesson: 500 } },
    ]);

    const result = await computeAbonementSummary("student_1");

    expect(result.mode).toBe("SINGLE_GROUP");
    expect(result.groups).toEqual([
      { groupId: "g1", groupName: "Математика ОГЭ", pricePerLesson: 500, remainingLessons: 3 },
    ]);
    expect(result.minRemainingLessons).toBe(3);
    expect(result.individual).toBeNull();
  });

  it("MULTI_GROUP: reports each group's remaining lessons against the same shared balance, never doubled", async () => {
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
    dbMock.groupStudent.findMany.mockResolvedValue([
      { group: { id: "g1", name: "Группа А", pricePerLesson: 500 } },
      { group: { id: "g2", name: "Группа Б", pricePerLesson: 250 } },
    ]);

    const result = await computeAbonementSummary("student_1");

    expect(result.mode).toBe("MULTI_GROUP");
    expect(result.groups).toEqual([
      { groupId: "g1", groupName: "Группа А", pricePerLesson: 500, remainingLessons: 2 },
      { groupId: "g2", groupName: "Группа Б", pricePerLesson: 250, remainingLessons: 4 },
    ]);
    // The lowest figure across groups drives the warning, not a sum of both.
    expect(result.minRemainingLessons).toBe(2);
  });

  it("INDIVIDUAL: falls back to the most recent individual session's price when the student has no group", async () => {
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 2000 } });
    dbMock.groupStudent.findMany.mockResolvedValue([]);
    dbMock.classSession.findFirst.mockResolvedValue({ pricePerLesson: 800 });

    const result = await computeAbonementSummary("student_1");

    expect(result.mode).toBe("INDIVIDUAL");
    expect(result.individual).toEqual({ pricePerLesson: 800, remainingLessons: 2 });
    expect(result.minRemainingLessons).toBe(2);
    expect(dbMock.classSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "student_1", type: "INDIVIDUAL", pricePerLesson: { not: null }, isTrial: false },
        orderBy: { scheduledAt: "desc" },
      }),
    );
  });

  it("excludes trial sessions from the individual-rate lookup's where clause", async () => {
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 2000 } });
    dbMock.groupStudent.findMany.mockResolvedValue([]);
    dbMock.classSession.findFirst.mockResolvedValue({ pricePerLesson: 800 });

    await computeAbonementSummary("student_1");

    expect(dbMock.classSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: "student_1", type: "INDIVIDUAL", pricePerLesson: { not: null }, isTrial: false },
      }),
    );
  });

  it("NONE: no groups and no priced individual session leaves everything null", async () => {
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    dbMock.groupStudent.findMany.mockResolvedValue([]);
    dbMock.classSession.findFirst.mockResolvedValue(null);

    const result = await computeAbonementSummary("student_1");

    expect(result.mode).toBe("NONE");
    expect(result.groups).toEqual([]);
    expect(result.individual).toBeNull();
    expect(result.minRemainingLessons).toBeNull();
  });

  it("treats a zero-price group as unusable but does not crash", async () => {
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 500 } });
    dbMock.groupStudent.findMany.mockResolvedValue([
      { group: { id: "g1", name: "Пробное занятие", pricePerLesson: 0 } },
    ]);

    const result = await computeAbonementSummary("student_1");

    expect(result.groups).toEqual([
      { groupId: "g1", groupName: "Пробное занятие", pricePerLesson: 0, remainingLessons: null },
    ]);
    expect(result.minRemainingLessons).toBeNull();
  });

  it("MIXED: reports both group and individual breakdowns when the student has both", async () => {
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
    dbMock.groupStudent.findMany.mockResolvedValue([
      { group: { id: "g1", name: "Группа А", pricePerLesson: 250 } },
    ]);
    dbMock.classSession.findFirst.mockResolvedValue({ pricePerLesson: 500 });

    const result = await computeAbonementSummary("student_1");

    expect(result.mode).toBe("MIXED");
    expect(result.groups).toEqual([
      { groupId: "g1", groupName: "Группа А", pricePerLesson: 250, remainingLessons: 4 },
    ]);
    expect(result.individual).toEqual({ pricePerLesson: 500, remainingLessons: 2 });
    // Lowest figure across BOTH breakdowns, still against the one shared balance.
    expect(result.minRemainingLessons).toBe(2);
  });
});

describe("getStudentLedger", () => {
  it("merges session charges and standalone payments chronologically with a running balance", async () => {
    dbMock.classSession.findMany.mockResolvedValue([
      {
        id: "session_1",
        scheduledAt: new Date("2026-08-01T10:00:00.000Z"),
        durationMinutes: 60,
        type: "GROUP",
        isFree: false,
        pricePerLesson: null,
        group: { name: "Группа А", pricePerLesson: 500 },
        teacher: { fullName: "Иван Иванов" },
        attendance: [{ status: "PRESENT" }],
        transactions: [{ amount: -500 }],
      },
    ]);
    dbMock.transaction.findMany.mockResolvedValue([
      {
        id: "tx_1",
        amount: 1000,
        type: "PAYMENT",
        description: null,
        createdAt: new Date("2026-07-30T09:00:00.000Z"),
      },
    ]);

    const { getStudentLedger } = await import("./abonement.service");
    const rows = await getStudentLedger("student_1");

    expect(rows).toEqual([
      expect.objectContaining({ id: "tx_1", kind: "TRANSACTION", amount: 1000, runningBalance: 1000 }),
      expect.objectContaining({
        id: "session_1",
        kind: "SESSION",
        title: "Группа А",
        isGroup: true,
        teacherName: "Иван Иванов",
        attendanceStatus: "PRESENT",
        amount: -500,
        runningBalance: 500,
      }),
    ]);
  });

  it("shows an unmarked past session with a null attendanceStatus and zero financial impact", async () => {
    dbMock.classSession.findMany.mockResolvedValue([
      {
        id: "session_1",
        scheduledAt: new Date(Date.now() - 2 * 60 * 60_000),
        durationMinutes: 60,
        type: "INDIVIDUAL",
        isFree: false,
        pricePerLesson: 1000,
        group: null,
        teacher: { fullName: "Иван Иванов" },
        attendance: [],
        transactions: [],
      },
    ]);
    dbMock.transaction.findMany.mockResolvedValue([]);

    const { getStudentLedger } = await import("./abonement.service");
    const rows = await getStudentLedger("student_1");

    expect(rows).toEqual([
      expect.objectContaining({
        id: "session_1",
        title: "Индивидуальное занятие",
        isGroup: false,
        attendanceStatus: null,
        amount: 0,
        runningBalance: 0,
      }),
    ]);
  });

  it("excludes a session that hasn't concluded yet", async () => {
    dbMock.classSession.findMany.mockResolvedValue([
      {
        id: "session_future",
        scheduledAt: new Date(Date.now() + 2 * 60 * 60_000),
        durationMinutes: 60,
        type: "INDIVIDUAL",
        isFree: false,
        pricePerLesson: 1000,
        group: null,
        teacher: null,
        attendance: [],
        transactions: [],
      },
    ]);
    dbMock.transaction.findMany.mockResolvedValue([]);

    const { getStudentLedger } = await import("./abonement.service");
    const rows = await getStudentLedger("student_1");

    expect(rows).toEqual([]);
  });
});

describe("getPendingChargePreview", () => {
  it("counts unmarked past sessions and projects the balance after charging them", async () => {
    dbMock.classSession.findMany.mockResolvedValue([
      {
        scheduledAt: new Date(Date.now() - 2 * 60 * 60_000),
        durationMinutes: 60,
        isFree: false,
        pricePerLesson: 1000,
        group: null,
        attendance: [],
      },
      {
        scheduledAt: new Date(Date.now() - 3 * 60 * 60_000),
        durationMinutes: 60,
        isFree: false,
        pricePerLesson: null,
        group: { pricePerLesson: 500 },
        attendance: [],
      },
    ]);

    const { getPendingChargePreview } = await import("./abonement.service");
    const result = await getPendingChargePreview("student_1", 2000);

    expect(result).toEqual({ count: 2, projectedBalance: 500 });
  });

  it("does not count a session the student has already been marked for", async () => {
    dbMock.classSession.findMany.mockResolvedValue([
      {
        scheduledAt: new Date(Date.now() - 2 * 60 * 60_000),
        durationMinutes: 60,
        isFree: false,
        pricePerLesson: 1000,
        group: null,
        attendance: [{ status: "PRESENT" }],
      },
    ]);

    const { getPendingChargePreview } = await import("./abonement.service");
    const result = await getPendingChargePreview("student_1", 2000);

    expect(result).toEqual({ count: 0, projectedBalance: 2000 });
  });

  it("excludes an isFree session from the projected charge", async () => {
    dbMock.classSession.findMany.mockResolvedValue([
      {
        scheduledAt: new Date(Date.now() - 2 * 60 * 60_000),
        durationMinutes: 60,
        isFree: true,
        pricePerLesson: 1000,
        group: null,
        attendance: [],
      },
    ]);

    const { getPendingChargePreview } = await import("./abonement.service");
    const result = await getPendingChargePreview("student_1", 2000);

    expect(result).toEqual({ count: 1, projectedBalance: 2000 });
  });
});
