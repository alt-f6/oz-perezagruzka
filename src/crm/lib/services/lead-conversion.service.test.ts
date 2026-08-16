import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  lead: { findUnique: vi.fn() },
  student: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));

const { performLeadConversion } = await import("@/crm/lib/services/lead-conversion.service");

interface TxMock {
  user: { create: ReturnType<typeof vi.fn> };
  student: { create: ReturnType<typeof vi.fn> };
  lead: { update: ReturnType<typeof vi.fn> };
}

function makeTx(): TxMock {
  return {
    user: { create: vi.fn().mockResolvedValue({ id: "user_1" }) },
    student: { create: vi.fn().mockResolvedValue({ id: "student_new" }) },
    lead: { update: vi.fn().mockResolvedValue({ id: "lead_1" }) },
  };
}

const leadFixture = {
  id: "lead_1",
  name: "Иван Иванов",
  phone: "+79990000001",
  email: null,
  status: "NEW",
  convertedUserId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("performLeadConversion", () => {
  it("returns an error when the lead does not exist", async () => {
    dbMock.lead.findUnique.mockResolvedValue(null);

    const result = await performLeadConversion("missing_lead");

    expect(result.error).toBeTruthy();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns an error when the lead was already converted", async () => {
    dbMock.lead.findUnique.mockResolvedValue({ ...leadFixture, convertedUserId: "user_x" });

    const result = await performLeadConversion("lead_1");

    expect(result.error).toBeTruthy();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects conversion when a student already has the lead's phone (duplicate resolution)", async () => {
    dbMock.lead.findUnique.mockResolvedValue(leadFixture);
    dbMock.student.findUnique.mockResolvedValue({ id: "existing_student" });

    const result = await performLeadConversion("lead_1");

    expect(result.error).toBeTruthy();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("creates User + Student and marks the lead CONVERTED atomically on success", async () => {
    dbMock.lead.findUnique.mockResolvedValue(leadFixture);
    dbMock.student.findUnique.mockResolvedValue(null);
    const tx = makeTx();
    dbMock.$transaction.mockImplementation(async (callback: (tx: TxMock) => unknown) =>
      callback(tx),
    );

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
    dbMock.lead.findUnique.mockResolvedValue(leadFixture);
    dbMock.student.findUnique.mockResolvedValue(null);
    dbMock.$transaction.mockRejectedValue(new Error("unique constraint violated"));

    const result = await performLeadConversion("lead_1");

    expect(result.error).toContain("unique constraint violated");
  });
});
