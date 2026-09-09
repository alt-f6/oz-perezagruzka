import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { rublesToKopecks } from "@/crm/lib/money";

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
  student: { updateMany: ReturnType<typeof vi.fn> };
}

function makeTx(createImpl: () => unknown): TxMock {
  return {
    paymentIntent: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    transaction: { create: vi.fn(createImpl) },
    // Claims the first-payment offer by default (as if offerSentAt was null);
    // individual tests override this to simulate an already-claimed student.
    student: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
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
      amount: rublesToKopecks(5000),
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
      amount: rublesToKopecks(5000),
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
      finalizeSuccessfulPayment({
        paymentId: "pay_1",
        studentId: "student_1",
        amount: rublesToKopecks(5000),
      }),
    ).rejects.toThrow("connection lost");
  });

  it("claims the first-payment offer (offerSentAt null -> now) when the charge is real", async () => {
    const tx = makeTx(() => ({ id: "tx_1" }));
    dbMock.$transaction.mockImplementation(async (callback: (tx: TxMock) => unknown) =>
      callback(tx),
    );

    await finalizeSuccessfulPayment({
      paymentId: "pay_1",
      studentId: "student_1",
      amount: rublesToKopecks(5000),
    });

    expect(tx.student.updateMany).toHaveBeenCalledWith({
      where: { id: "student_1", offerSentAt: null },
      data: { offerSentAt: expect.any(Date) },
    });
  });

  it("does not attempt to claim the offer on a duplicate webhook delivery", async () => {
    const tx = makeTx(() => {
      throw p2002();
    });
    dbMock.$transaction.mockImplementation(async (callback: (tx: TxMock) => unknown) =>
      callback(tx),
    );

    await finalizeSuccessfulPayment({
      paymentId: "pay_1",
      studentId: "student_1",
      amount: rublesToKopecks(5000),
    });

    expect(tx.student.updateMany).not.toHaveBeenCalled();
  });

  it("still returns true (credit unaffected) when offerSentAt was already set by a prior payment", async () => {
    const tx = makeTx(() => ({ id: "tx_1" }));
    tx.student.updateMany.mockResolvedValue({ count: 0 });
    dbMock.$transaction.mockImplementation(async (callback: (tx: TxMock) => unknown) =>
      callback(tx),
    );

    const result = await finalizeSuccessfulPayment({
      paymentId: "pay_2",
      studentId: "student_1",
      amount: rublesToKopecks(3000),
    });

    expect(result).toBe(true);
  });

  it("never rolls back the credit even if the offer send blows up", async () => {
    const tx = makeTx(() => ({ id: "tx_1" }));
    dbMock.$transaction.mockImplementation(async (callback: (tx: TxMock) => unknown) =>
      callback(tx),
    );
    // sendFirstPaymentOffer looks the student up via db.student.findUnique;
    // simulate that lookup itself blowing up.
    dbMock.student.findUnique.mockRejectedValue(new Error("db down"));

    const result = await finalizeSuccessfulPayment({
      paymentId: "pay_1",
      studentId: "student_1",
      amount: rublesToKopecks(5000),
    });

    expect(result).toBe(true);
  });
});
