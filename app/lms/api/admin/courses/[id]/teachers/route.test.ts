import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const courseFindUniqueMock = vi.fn();
const userCountMock = vi.fn();
const deleteManyMock = vi.fn();
const createManyMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    course: { findUnique: (...args: unknown[]) => courseFindUniqueMock(...args) },
    user: { count: (...args: unknown[]) => userCountMock(...args) },
    courseTeacher: {
      deleteMany: (...args: unknown[]) => deleteManyMock(...args),
      createMany: (...args: unknown[]) => createManyMock(...args),
    },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

const ctx = { params: Promise.resolve({ id: "c1" }) };

function put(body: unknown) {
  return new NextRequest("http://localhost/api/admin/courses/c1/teachers", { method: "PUT", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({ id: "mgr_1", role: "MANAGER" });
  courseFindUniqueMock.mockResolvedValue({ id: "c1" });
  deleteManyMock.mockReturnValue("delete-op");
  createManyMock.mockReturnValue("create-op");
  transactionMock.mockResolvedValue([]);
});

describe("PUT /api/admin/courses/[id]/teachers", () => {
  it("is ADMIN/MANAGER only", async () => {
    userCountMock.mockResolvedValue(0);
    const { PUT } = await import("./route");

    await PUT(put({ teacher_ids: [] }), ctx);

    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN", "MANAGER"], { adminBypass: true });
  });

  it("replaces the link set in one transaction, de-duplicating ids", async () => {
    userCountMock.mockResolvedValue(2);
    const { PUT } = await import("./route");

    const res = await PUT(put({ teacher_ids: ["t1", "t2", "t1"] }), ctx);

    expect((await res.json()).teacher_ids).toEqual(["t1", "t2"]);
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { courseId: "c1", teacherId: { notIn: ["t1", "t2"] } } });
    expect(createManyMock).toHaveBeenCalledWith({
      data: [
        { courseId: "c1", teacherId: "t1" },
        { courseId: "c1", teacherId: "t2" },
      ],
      skipDuplicates: true,
    });
    expect(transactionMock).toHaveBeenCalledWith(["delete-op", "create-op"]);
  });

  it("rejects ids that aren't active teachers", async () => {
    userCountMock.mockResolvedValue(1);
    const { PUT } = await import("./route");

    const res = await PUT(put({ teacher_ids: ["t1", "student-1"] }), ctx);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_teacher");
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    const { PUT } = await import("./route");

    const res = await PUT(put({ teacher_ids: "t1" }), ctx);

    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown course", async () => {
    courseFindUniqueMock.mockResolvedValue(null);
    const { PUT } = await import("./route");

    const res = await PUT(put({ teacher_ids: [] }), ctx);

    expect(res.status).toBe(404);
  });
});
