import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  student: { findUnique: vi.fn() },
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("@/crm/lib/services/notification.service", () => ({
  getNotificationProvider: vi.fn(() => ({
    sendDebtReminder: vi.fn(),
    sendPaymentReceipt: vi.fn(),
    sendLessonReminder: vi.fn(),
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { finalizeSuccessfulPayment } = await import("@/crm/lib/services/yookassa.service");

interface TxMock {
  paymentIntent: { updateMany: ReturnType<typeof vi.fn> };
  transaction: { create: ReturnType<typeof vi.fn> };
}

function makeTx(createImpl: () => unknown): TxMock {
  return {
    paymentIntent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    transaction: { create: vi.fn(createImpl) },
  };
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.student.findUnique.mockResolvedValue(null);
});

describe("finalizeSuccessfulPayment", () => {
  it("credits the balance and returns true on first delivery", async () => {
    const tx = makeTx(() => ({ id: "tx_1" }));
    dbMock.$transaction.mockImplementation(async (callback: (tx: TxMock) => unknown) =>
      callback(tx),
    );

    const result = await finalizeSuccessfulPayment({
      paymentId: "pay_1",
      studentId: "student_1",
      amount: 5000,
    });

    expect(result).toBe(true);
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: {
        studentId: "student_1",
        amount: 5000,
        type: "PAYMENT",
        description: "Онлайн-оплата через YooKassa",
        idempotencyKey: "pay_1",
      },
    });
  });

  it("rejects a duplicate webhook delivery (unique idempotencyKey violation) without double-crediting", async () => {
    const tx = makeTx(() => {
      throw p2002();
    });
    dbMock.$transaction.mockImplementation(async (callback: (tx: TxMock) => unknown) =>
      callback(tx),
    );

    const result = await finalizeSuccessfulPayment({
      paymentId: "pay_1",
      studentId: "student_1",
      amount: 5000,
    });

    expect(result).toBe(false);
  });

  it("re-throws unexpected transaction errors instead of swallowing them as a duplicate", async () => {
    const tx = makeTx(() => {
      throw new Error("connection lost");
    });
    dbMock.$transaction.mockImplementation(async (callback: (tx: TxMock) => unknown) =>
      callback(tx),
    );

    await expect(
      finalizeSuccessfulPayment({ paymentId: "pay_1", studentId: "student_1", amount: 5000 }),
    ).rejects.toThrow("connection lost");
  });
});
