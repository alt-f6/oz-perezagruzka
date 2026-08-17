import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));

const { performLeadConversion } = await import("@/crm/lib/services/lead-conversion.service");

interface TxMock {
  $queryRaw: ReturnType<typeof vi.fn>;
  student: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  user: { create: ReturnType<typeof vi.fn> };
  lead: { update: ReturnType<typeof vi.fn> };
}

function makeTx(lockedLeadRows: unknown[]): TxMock {
  return {
    $queryRaw: vi.fn().mockResolvedValue(lockedLeadRows),
    student: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "student_new" }),
    },
    user: { create: vi.fn().mockResolvedValue({ id: "user_1" }) },
    lead: { update: vi.fn().mockResolvedValue({ id: "lead_1" }) },
  };
}

const leadFixture = {
  id: "lead_1",
  name: "Иван Иванов",
  phone: "+79990000001",
  email: null,
  convertedUserId: null,
};

function runTransaction(tx: TxMock) {
  dbMock.$transaction.mockImplementation(async (callback: (tx: TxMock) => unknown) =>
    callback(tx),
  );
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("performLeadConversion", () => {
  it("returns an error when the lead does not exist", async () => {
    const tx = runTransaction(makeTx([]));

    const result = await performLeadConversion("missing_lead");

    expect(result.error).toBeTruthy();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("returns an error when the lead was already converted", async () => {
    const tx = runTransaction(makeTx([{ ...leadFixture, convertedUserId: "user_x" }]));

    const result = await performLeadConversion("lead_1");

    expect(result.error).toBeTruthy();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("rejects conversion when a student already has the lead's phone (duplicate resolution)", async () => {
    const tx = runTransaction(makeTx([leadFixture]));
    tx.student.findUnique.mockResolvedValue({ id: "existing_student" });

    const result = await performLeadConversion("lead_1");

    expect(result.error).toBeTruthy();
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it("locks the lead row (SELECT ... FOR UPDATE) before reading it, to prevent concurrent conversion races", async () => {
    const tx = runTransaction(makeTx([leadFixture]));

    await performLeadConversion("lead_1");

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [strings] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray];
    expect(strings.join("")).toContain("FOR UPDATE");
  });

  it("creates User + Student and marks the lead CONVERTED atomically on success", async () => {
    const tx = runTransaction(makeTx([leadFixture]));

    const result = await performLeadConversion("lead_1");

    expect(result.error).toBeUndefined();
    expect(tx.user.create).toHaveBeenCalledWith({
      data: { fullName: leadFixture.name, phone: leadFixture.phone, email: leadFixture.email, role: "STUDENT" },
    });
    expect(tx.student.create).toHaveBeenCalledWith({
      data: { fullName: leadFixture.name, phone: leadFixture.phone, userId: "user_1" },
    });
    expect(tx.lead.update).toHaveBeenCalledWith({
      where: { id: "lead_1" },
      data: { status: "CONVERTED", convertedUserId: "user_1" },
    });
  });

  it("surfaces a rollback error without leaking a partial result when the transaction throws", async () => {
    dbMock.$transaction.mockRejectedValue(new Error("unique constraint violated"));

    const result = await performLeadConversion("lead_1");

    expect(result.error).toContain("unique constraint violated");
  });
});
