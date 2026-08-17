import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  transaction: { aggregate: vi.fn() },
  student: { findUnique: vi.fn() },
}));

const notificationProviderMock = vi.hoisted(() => ({
  sendDebtReminder: vi.fn(),
  sendPaymentReceipt: vi.fn(),
  sendLessonReminder: vi.fn(),
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("@/crm/lib/services/notification.service", () => ({
  getNotificationProvider: vi.fn(() => notificationProviderMock),
}));

const { BillingService } = await import("@/crm/lib/services/billing.service");

interface TxMock {
  $queryRaw: ReturnType<typeof vi.fn>;
  classSession: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
  freeze: { findFirst: ReturnType<typeof vi.fn> };
  attendance: { upsert: ReturnType<typeof vi.fn> };
  transaction: { deleteMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
}

function makeTx(overrides: { classSession: unknown; freeze?: unknown }): TxMock {
  return {
    $queryRaw: vi.fn().mockResolvedValue(undefined),
    classSession: { findUniqueOrThrow: vi.fn().mockResolvedValue(overrides.classSession) },
    freeze: { findFirst: vi.fn().mockResolvedValue(overrides.freeze ?? null) },
    attendance: { upsert: vi.fn().mockResolvedValue({ id: "att_1" }) },
    transaction: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({ id: "tx_1" }),
    },
  };
}

function runWithTx(tx: TxMock) {
  dbMock.$transaction.mockImplementation(async (callback: (tx: TxMock) => unknown) =>
    callback(tx),
  );
}

const classSessionFixture = {
  id: "session_1",
  scheduledAt: new Date("2026-08-03T10:00:00.000Z"),
  group: { pricePerLesson: 1000 },
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  dbMock.student.findUnique.mockResolvedValue(null);
});

describe("BillingService.markAttendanceAndCharge", () => {
  it("creates exactly one LESSON_CHARGE debit for PRESENT", async () => {
    const tx = makeTx({ classSession: classSessionFixture });
    runWithTx(tx);

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "PRESENT");

    expect(tx.transaction.deleteMany).toHaveBeenCalledWith({
      where: { studentId: "student_1", classSessionId: "session_1", type: "LESSON_CHARGE" },
    });
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: {
        studentId: "student_1",
        classSessionId: "session_1",
        amount: -1000,
        type: "LESSON_CHARGE",
        idempotencyKey: "lesson_charge:session_1:student_1",
      },
    });
  });

  it("does not create a charge for EXCUSED (deletes any prior charge instead)", async () => {
    const tx = makeTx({ classSession: classSessionFixture });
    runWithTx(tx);

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "EXCUSED");

    expect(tx.transaction.deleteMany).toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it("suppresses the charge when an active freeze covers the session day", async () => {
    const tx = makeTx({
      classSession: classSessionFixture,
      freeze: { id: "freeze_1" },
    });
    runWithTx(tx);

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "PRESENT");

    expect(tx.freeze.findFirst).toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.attendance.upsert).toHaveBeenCalled();
  });

  it("does not query freeze status for a non-billable status (EXCUSED)", async () => {
    const tx = makeTx({ classSession: classSessionFixture });
    runWithTx(tx);

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "EXCUSED");

    expect(tx.freeze.findFirst).not.toHaveBeenCalled();
  });

  it("charges -pricePerLesson for ABSENT outside any freeze", async () => {
    const tx = makeTx({ classSession: classSessionFixture });
    runWithTx(tx);

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "ABSENT");

    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: {
        studentId: "student_1",
        classSessionId: "session_1",
        amount: -1000,
        type: "LESSON_CHARGE",
        idempotencyKey: "lesson_charge:session_1:student_1",
      },
    });
  });
});

describe("BillingService.markAttendanceAndCharge — freeze UTC day-boundary edge cases", () => {
  it("suppresses the charge when the session falls on the freeze's startDate (inclusive)", async () => {
    const session = { ...classSessionFixture, scheduledAt: new Date("2026-08-03T23:59:59.000Z") };
    const tx = makeTx({ classSession: session, freeze: { id: "freeze_1" } });
    runWithTx(tx);

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "PRESENT");

    expect(tx.freeze.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startDate: { lte: new Date("2026-08-03T00:00:00.000Z") },
          endDate: { gte: new Date("2026-08-03T00:00:00.000Z") },
        }),
      }),
    );
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it("suppresses the charge when the session falls on the freeze's endDate (inclusive)", async () => {
    const session = { ...classSessionFixture, scheduledAt: new Date("2026-08-05T00:00:01.000Z") };
    const tx = makeTx({ classSession: session, freeze: { id: "freeze_1" } });
    runWithTx(tx);

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "PRESENT");

    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it("charges normally for a session one UTC day before the freeze starts", async () => {
    const session = { ...classSessionFixture, scheduledAt: new Date("2026-08-02T23:59:59.000Z") };
    const tx = makeTx({ classSession: session });
    runWithTx(tx);

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "PRESENT");

    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: {
        studentId: "student_1",
        classSessionId: "session_1",
        amount: -1000,
        type: "LESSON_CHARGE",
        idempotencyKey: "lesson_charge:session_1:student_1",
      },
    });
  });

  it("charges normally for a session one UTC day after the freeze ends", async () => {
    const session = { ...classSessionFixture, scheduledAt: new Date("2026-08-06T00:00:00.000Z") };
    const tx = makeTx({ classSession: session });
    runWithTx(tx);

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "PRESENT");

    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: {
        studentId: "student_1",
        classSessionId: "session_1",
        amount: -1000,
        type: "LESSON_CHARGE",
        idempotencyKey: "lesson_charge:session_1:student_1",
      },
    });
  });
});

describe("BillingService.markAttendanceAndCharge — insufficient balance notification", () => {
  it("sends a debt reminder to parents when the post-charge balance is negative", async () => {
    const tx = makeTx({ classSession: classSessionFixture });
    runWithTx(tx);
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: -500 } });
    dbMock.student.findUnique.mockResolvedValue({
      id: "student_1",
      fullName: "Тест Тестов",
      parents: [{ parent: { telegramChatId: "chat_1" } }],
    });

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "PRESENT");

    expect(notificationProviderMock.sendDebtReminder).toHaveBeenCalledWith(
      { telegramChatId: "chat_1", fullName: "Тест Тестов" },
      -500,
    );
  });

  it("does not send a debt reminder when the balance stays non-negative", async () => {
    const tx = makeTx({ classSession: classSessionFixture });
    runWithTx(tx);
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "PRESENT");

    expect(notificationProviderMock.sendDebtReminder).not.toHaveBeenCalled();
  });
});

describe("BillingService.markAttendanceAndCharge — duplicate-marking prevention", () => {
  it("re-marking the same session/student deletes the prior LESSON_CHARGE before creating the new one (no accumulation)", async () => {
    const tx = makeTx({ classSession: classSessionFixture });
    runWithTx(tx);

    await BillingService.markAttendanceAndCharge("session_1", "student_1", "PRESENT");
    await BillingService.markAttendanceAndCharge("session_1", "student_1", "PRESENT");

    expect(tx.transaction.deleteMany).toHaveBeenCalledTimes(2);
    expect(tx.transaction.create).toHaveBeenCalledTimes(2);
    expect(tx.transaction.deleteMany.mock.invocationCallOrder[1]).toBeLessThan(
      tx.transaction.create.mock.invocationCallOrder[1],
    );
  });
});
