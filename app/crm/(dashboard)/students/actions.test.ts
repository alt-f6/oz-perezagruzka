import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  // Used directly (outside any transaction) by sendFirstPaymentOffer, which
  // updateStudentBalance fires after a claimed manual credit -- and now also
  // by deleteStudent's soft-delete update.
  student: { findUnique: vi.fn(), update: vi.fn() },
  // Read directly (outside any transaction) by updateStudentBalance, to
  // snapshot the pre-adjustment balance for the ADJUST_BALANCE audit entry.
  transaction: { aggregate: vi.fn() },
  activityLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  // Read directly (outside any transaction) by logActivity to resolve the
  // acting user's display name for the audit entry.
  user: { findUnique: vi.fn() },
}));
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/rbac", () => ({ requireRole: requireRoleMock }));
vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const { createStudent, updateStudent, deleteStudent, updateStudentBalance } = await import("./actions");

interface TxMock {
  student: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  user: { findUnique: ReturnType<typeof vi.fn> };
  groupStudent: { create: ReturnType<typeof vi.fn> };
}

function makeTx(existingStudent: { id: string } | null = null): TxMock {
  return {
    student: {
      findUnique: vi.fn().mockResolvedValue(existingStudent),
      // Email-collision pre-check: no other student owns the email by default.
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "student_new" }),
      update: vi.fn().mockResolvedValue({ id: "student_1" }),
    },
    // Email-collision pre-check against existing accounts: none by default.
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    groupStudent: { create: vi.fn().mockResolvedValue({}) },
  };
}

function runWithTx(tx: TxMock) {
  dbMock.$transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
  dbMock.student.findUnique.mockResolvedValue(null);
  dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  dbMock.activityLog.create.mockResolvedValue({});
  dbMock.user.findUnique.mockResolvedValue(null);
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
        email: null,
        parentName: null,
        parentPhone: null,
        comment: null,
        grade: null,
        examType: null,
        subject: null,
        school: null,
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
        email: null,
        parentName: "Мария Иванова",
        parentPhone: "+79990001122",
        comment: "Готовится к ОГЭ",
        grade: 9,
        examType: "OGE",
        subject: "Математика",
        school: null,
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
        email: null,
        parentName: "Мария Иванова",
        parentPhone: "+79990001122",
        comment: "Перевёлся из другой школы",
        grade: 11,
        examType: "EGE",
        subject: "Физика",
        school: null,
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
        email: null,
        parentName: null,
        parentPhone: null,
        comment: null,
        grade: null,
        examType: null,
        subject: null,
        school: null,
      },
    });
  });

  it("rejects a non-staff caller", async () => {
    requireRoleMock.mockRejectedValue(new Error("forbidden"));

    await expect(
      updateStudent("student_1", { name: "Иван Иванов", phone: "" }),
    ).rejects.toThrow("forbidden");
  });

  it("persists a normalized email onto the student record", async () => {
    const tx = makeTx({ id: "student_1" });
    runWithTx(tx);

    const result = await updateStudent("student_1", {
      name: "Иван Иванов",
      phone: "",
      email: "Student@Example.COM",
    });

    expect(result.error).toBeUndefined();
    expect(tx.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "student@example.com" }),
      }),
    );
  });

  it("gracefully rejects an email already used by another student (no raw constraint error)", async () => {
    const tx = makeTx({ id: "student_1" });
    tx.student.findFirst.mockResolvedValue({ id: "other_student" });
    runWithTx(tx);

    const result = await updateStudent("student_1", {
      name: "Иван Иванов",
      phone: "",
      email: "dup@example.com",
    });

    expect(result.error).toMatch(/уже используется другим учеником/);
    expect(tx.student.update).not.toHaveBeenCalled();
  });

  it("gracefully rejects an email already bound to another account", async () => {
    const tx = makeTx({ id: "student_1" });
    tx.user.findUnique.mockResolvedValue({ id: "someone_elses_user" });
    runWithTx(tx);

    const result = await updateStudent("student_1", {
      name: "Иван Иванов",
      phone: "",
      email: "taken@example.com",
    });

    expect(result.error).toMatch(/занят другим аккаунтом/);
    expect(tx.student.update).not.toHaveBeenCalled();
  });
});

describe("updateStudentBalance", () => {
  interface BalanceTxMock {
    transaction: { create: ReturnType<typeof vi.fn> };
    student: { updateMany: ReturnType<typeof vi.fn> };
  }

  function makeBalanceTx(offerClaimCount = 1): BalanceTxMock {
    return {
      transaction: { create: vi.fn().mockResolvedValue({ id: "txn_1" }) },
      student: { updateMany: vi.fn().mockResolvedValue({ count: offerClaimCount }) },
    };
  }

  function runBalanceTx(tx: BalanceTxMock) {
    dbMock.$transaction.mockImplementation(async (cb: (tx: BalanceTxMock) => unknown) => cb(tx));
  }

  it("records a positive amount as PAYMENT and claims the first-payment offer", async () => {
    const tx = makeBalanceTx();
    runBalanceTx(tx);

    const result = await updateStudentBalance("student_1", 1000, "Пополнение");

    expect(result.error).toBeUndefined();
    expect(tx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 1000, type: "PAYMENT" }) }),
    );
    expect(tx.student.updateMany).toHaveBeenCalledWith({
      where: { id: "student_1", offerSentAt: null },
      data: { offerSentAt: expect.any(Date) },
    });
  });

  it("records a negative amount as ADJUSTMENT with the 'Корректировка:' prefix and never attempts to claim the offer", async () => {
    const tx = makeBalanceTx();
    runBalanceTx(tx);

    const result = await updateStudentBalance("student_1", -500, "случайный платеж");

    expect(result.error).toBeUndefined();
    expect(tx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: -500,
          type: "ADJUSTMENT",
          description: "Корректировка: случайный платеж",
        }),
      }),
    );
    expect(tx.student.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a negative amount with no comment before touching the database", async () => {
    const tx = makeBalanceTx();
    runBalanceTx(tx);

    const result = await updateStudentBalance("student_1", -500, "");

    expect(result.error).toBeTruthy();
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it("succeeds without error when the offer was already claimed by a prior payment", async () => {
    const tx = makeBalanceTx(0);
    runBalanceTx(tx);

    const result = await updateStudentBalance("student_1", 1000, "Повторное пополнение");

    expect(result.error).toBeUndefined();
  });

  it("returns a graceful error for a non-ADMIN caller instead of throwing", async () => {
    requireRoleMock.mockRejectedValue(new Error("forbidden"));

    const result = await updateStudentBalance("student_1", 1000, "Пополнение");

    expect(result.error).toBeTruthy();
  });
});

describe("activity logging", () => {
  it("logs a CREATE entry after successfully creating a student", async () => {
    const tx = makeTx(null);
    runWithTx(tx);

    await createStudent({ name: "Анна Смирнова", phone: "+79997654321", groupId: "" });

    expect(dbMock.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CREATE",
          entityType: "STUDENT",
          entityId: "student_new",
          entityTitle: "Анна Смирнова",
          userId: "admin_1",
        }),
      }),
    );
  });

  it("does not log CREATE when creation fails (duplicate phone)", async () => {
    const tx = makeTx({ id: "student_existing" });
    runWithTx(tx);

    await createStudent({ name: "Иван Иванов", phone: "+79991234567", groupId: "" });

    expect(dbMock.activityLog.create).not.toHaveBeenCalled();
  });

  it("logs an UPDATE entry after successfully editing a student", async () => {
    const tx = makeTx(null);
    runWithTx(tx);

    await updateStudent("student_1", { name: "Пётр Петров", phone: "" });

    expect(dbMock.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "UPDATE",
          entityType: "STUDENT",
          entityId: "student_1",
          entityTitle: "Пётр Петров",
        }),
      }),
    );
  });

  it("logs a DELETE entry after soft-deleting a student", async () => {
    dbMock.student.update.mockResolvedValue({});

    const result = await deleteStudent("student_1");

    expect(result).toEqual({});
    expect(dbMock.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "DELETE", entityType: "STUDENT", entityId: "student_1" }),
      }),
    );
  });

  it("logs an ADJUST_BALANCE entry with amount, reason, and previous balance", async () => {
    const tx = { transaction: { create: vi.fn().mockResolvedValue({ id: "txn_1" }) }, student: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };
    dbMock.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
    dbMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: 500 } });

    await updateStudentBalance("student_1", -200, "ошибочный платеж");

    expect(dbMock.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ADJUST_BALANCE",
          entityType: "TRANSACTION",
          entityId: "student_1",
          details: {
            amount: -200,
            reason: "Корректировка: ошибочный платеж",
            previousBalance: 500,
          },
        }),
      }),
    );
  });
});
