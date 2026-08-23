import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({ $transaction: vi.fn() }));
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/rbac", () => ({ requireRole: requireRoleMock }));
vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const { createStudent } = await import("./actions");

interface TxMock {
  student: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  groupStudent: { create: ReturnType<typeof vi.fn> };
}

function makeTx(existingStudent: { id: string } | null = null): TxMock {
  return {
    student: {
      findUnique: vi.fn().mockResolvedValue(existingStudent),
      create: vi.fn().mockResolvedValue({ id: "student_new" }),
    },
    groupStudent: { create: vi.fn().mockResolvedValue({}) },
  };
}

function runWithTx(tx: TxMock) {
  dbMock.$transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
});

describe("createStudent", () => {
  it("rejects creation when a student with the same phone already exists", async () => {
    const tx = makeTx({ id: "student_existing" });
    runWithTx(tx);

    const result = await createStudent({ name: "Иван Иванов", phone: "+79991234567", groupId: "" });

    expect(result.error).toMatch(/уже существует/);
    expect(tx.student.findUnique).toHaveBeenCalledWith({
      where: { phone: "+79991234567" },
      select: { id: true },
    });
    expect(tx.student.create).not.toHaveBeenCalled();
  });

  it("creates the student when the phone is free", async () => {
    const tx = makeTx(null);
    runWithTx(tx);

    const result = await createStudent({ name: "Иван Иванов", phone: "+79991234567", groupId: "" });

    expect(result.error).toBeUndefined();
    expect(tx.student.create).toHaveBeenCalledWith({
      data: { fullName: "Иван Иванов", phone: "+79991234567" },
      select: { id: true },
    });
  });

  it("skips the duplicate-phone check entirely when no phone is provided", async () => {
    const tx = makeTx(null);
    runWithTx(tx);

    const result = await createStudent({ name: "Иван Иванов", phone: "", groupId: "" });

    expect(result.error).toBeUndefined();
    expect(tx.student.findUnique).not.toHaveBeenCalled();
    expect(tx.student.create).toHaveBeenCalled();
  });

  it("still assigns the created student to a group when groupId is provided", async () => {
    const tx = makeTx(null);
    runWithTx(tx);

    await createStudent({
      name: "Иван Иванов",
      phone: "",
      groupId: "11111111-1111-4111-8111-111111111111",
    });

    expect(tx.groupStudent.create).toHaveBeenCalledWith({
      data: { groupId: "11111111-1111-4111-8111-111111111111", studentId: "student_new" },
    });
  });
});
