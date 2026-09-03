import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({ $transaction: vi.fn() }));
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/rbac", () => ({ requireRole: requireRoleMock }));
vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const { createStudent, updateStudent } = await import("./actions");

interface TxMock {
  student: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  groupStudent: { create: ReturnType<typeof vi.fn> };
}

function makeTx(existingStudent: { id: string } | null = null): TxMock {
  return {
    student: {
      findUnique: vi.fn().mockResolvedValue(existingStudent),
      create: vi.fn().mockResolvedValue({ id: "student_new" }),
      update: vi.fn().mockResolvedValue({ id: "student_1" }),
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
      data: {
        fullName: "Иван Иванов",
        phone: "+79991234567",
        parentName: null,
        parentPhone: null,
        comment: null,
        grade: null,
        examType: null,
        subject: null,
      },
      select: { id: true },
    });
  });

  it("persists parent details and educational fields from the create modal (DATA-01/03)", async () => {
    const tx = makeTx(null);
    runWithTx(tx);

    const result = await createStudent({
      name: "Иван Иванов",
      phone: "",
      groupId: "",
      parentName: "Мария Иванова",
      parentPhone: "+79990001122",
      comment: "Готовится к ОГЭ",
      grade: 9,
      examType: "OGE",
      subject: "Математика",
    });

    expect(result.error).toBeUndefined();
    expect(tx.student.create).toHaveBeenCalledWith({
      data: {
        fullName: "Иван Иванов",
        phone: null,
        parentName: "Мария Иванова",
        parentPhone: "+79990001122",
        comment: "Готовится к ОГЭ",
        grade: 9,
        examType: "OGE",
        subject: "Математика",
      },
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

describe("updateStudent", () => {
  it("persists edited parent details and domain fields to the student row (DATA-01)", async () => {
    const tx = makeTx(null);
    runWithTx(tx);

    const result = await updateStudent("student_1", {
      name: "Иван Иванов",
      phone: "+79991234567",
      parentName: "Мария Иванова",
      parentPhone: "+79990001122",
      comment: "Перевёлся из другой школы",
      grade: 11,
      examType: "EGE",
      subject: "Физика",
    });

    expect(result.error).toBeUndefined();
    expect(tx.student.update).toHaveBeenCalledWith({
      where: { id: "student_1" },
      data: {
        fullName: "Иван Иванов",
        phone: "+79991234567",
        parentName: "Мария Иванова",
        parentPhone: "+79990001122",
        comment: "Перевёлся из другой школы",
        grade: 11,
        examType: "EGE",
        subject: "Физика",
      },
    });
  });

  it("rejects a phone already used by a different student", async () => {
    const tx = makeTx({ id: "someone_else" });
    runWithTx(tx);

    const result = await updateStudent("student_1", {
      name: "Иван Иванов",
      phone: "+79991234567",
    });

    expect(result.error).toMatch(/уже существует/);
    expect(tx.student.update).not.toHaveBeenCalled();
  });

  it("allows saving when the matching phone belongs to the same student", async () => {
    const tx = makeTx({ id: "student_1" });
    runWithTx(tx);

    const result = await updateStudent("student_1", {
      name: "Иван Иванов",
      phone: "+79991234567",
    });

    expect(result.error).toBeUndefined();
    expect(tx.student.update).toHaveBeenCalled();
  });

  it("clears optional fields to null when submitted empty", async () => {
    const tx = makeTx(null);
    runWithTx(tx);

    await updateStudent("student_1", {
      name: "Иван Иванов",
      phone: "",
      parentName: "",
      parentPhone: "",
      comment: "",
      subject: "",
    });

    expect(tx.student.update).toHaveBeenCalledWith({
      where: { id: "student_1" },
      data: {
        fullName: "Иван Иванов",
        phone: null,
        parentName: null,
        parentPhone: null,
        comment: null,
        grade: null,
        examType: null,
        subject: null,
      },
    });
  });

  it("rejects a non-staff caller", async () => {
    requireRoleMock.mockRejectedValue(new Error("forbidden"));

    await expect(
      updateStudent("student_1", { name: "Иван Иванов", phone: "" }),
    ).rejects.toThrow("forbidden");
  });
});
