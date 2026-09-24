import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const getCourseModuleCountMock = vi.fn();
const enrollStudentsMock = vi.fn();
const filterStudentUserIdsMock = vi.fn();
const resolveGroupSnapshotMock = vi.fn();
const deleteManyMock = vi.fn();
const updateManyMock = vi.fn();
const findManyMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/lms/server/repos/enrollments", () => ({
  getCourseModuleCount: (...args: unknown[]) => getCourseModuleCountMock(...args),
  enrollStudents: (...args: unknown[]) => enrollStudentsMock(...args),
  filterStudentUserIds: (...args: unknown[]) => filterStudentUserIdsMock(...args),
  resolveGroupSnapshot: (...args: unknown[]) => resolveGroupSnapshotMock(...args),
}));
vi.mock("@/shared/lib/db", () => {
  const enrollment = {
    deleteMany: (...args: unknown[]) => deleteManyMock(...args),
    updateMany: (...args: unknown[]) => updateManyMock(...args),
    findMany: (...args: unknown[]) => findManyMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
  };
  return { db: { enrollment, $transaction: (fn: (tx: unknown) => unknown) => fn({ enrollment }) } };
});

const ctx = { params: Promise.resolve({ id: "c1" }) };
const post = (path: string, body: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/admin/courses/c1/enrollments${path}`, { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
  getCourseModuleCountMock.mockResolvedValue(4);
  enrollStudentsMock.mockResolvedValue({ created: 1, reactivated: 0, widened: 0, unchanged: 0 });
});

describe("POST /api/admin/courses/[id]/enrollments", () => {
  it("is ADMIN-only and enrolls validated students with the given access", async () => {
    filterStudentUserIdsMock.mockResolvedValue(["u1", "u2"]);
    const { POST } = await import("./route");

    const res = await POST(post("", { student_ids: ["u1", "u2", "u1"], access_through_module: 2 }), ctx);

    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN"], { adminBypass: true });
    expect(enrollStudentsMock).toHaveBeenCalledWith({ courseId: "c1", studentIds: ["u1", "u2"], accessThrough: 2 });
    expect((await res.json()).created).toBe(1);
  });

  it("rejects non-student ids, out-of-range access and unknown courses", async () => {
    const { POST } = await import("./route");

    filterStudentUserIdsMock.mockResolvedValue(["u1"]);
    expect((await POST(post("", { student_ids: ["u1", "teacher"] }), ctx)).status).toBe(400);

    expect((await POST(post("", { student_ids: ["u1"], access_through_module: 9 }), ctx)).status).toBe(400);

    getCourseModuleCountMock.mockResolvedValue(null);
    expect((await POST(post("", { student_ids: ["u1"] }), ctx)).status).toBe(404);

    expect(enrollStudentsMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/courses/[id]/enrollments/group", () => {
  const snapshot = {
    group: { id: "g1", name: "Группа" },
    toEnroll: [{ userId: "u1", fullName: "Аня" }],
    alreadyEnrolled: [{ userId: "u2", fullName: "Боря" }],
    withoutAccount: [{ studentId: "s3", fullName: "Вика" }],
  };

  it("dry run previews without writing", async () => {
    resolveGroupSnapshotMock.mockResolvedValue(snapshot);
    const { POST } = await import("./group/route");

    const json = await (await POST(post("/group", { group_id: "g1", dry_run: true }), ctx)).json();

    expect(json).toMatchObject({ ok: true, dry_run: true, to_enroll: snapshot.toEnroll, without_account: snapshot.withoutAccount });
    expect(enrollStudentsMock).not.toHaveBeenCalled();
  });

  it("applies to new and existing members, tagging the source group", async () => {
    resolveGroupSnapshotMock.mockResolvedValue(snapshot);
    const { POST } = await import("./group/route");

    await POST(post("/group", { group_id: "g1", access_through_module: 1 }), ctx);

    expect(enrollStudentsMock).toHaveBeenCalledWith({
      courseId: "c1",
      studentIds: ["u1", "u2"],
      accessThrough: 1,
      sourceGroupId: "g1",
    });
  });

  it("404s an unknown group", async () => {
    resolveGroupSnapshotMock.mockResolvedValue(null);
    const { POST } = await import("./group/route");
    expect((await POST(post("/group", { group_id: "zzz" }), ctx)).status).toBe(404);
  });
});

describe("POST /api/admin/courses/[id]/enrollments/bulk", () => {
  it("scopes every action to the course", async () => {
    deleteManyMock.mockResolvedValue({ count: 1 });
    const { POST } = await import("./bulk/route");

    await POST(post("/bulk", { action: "remove", ids: ["e1", "e2"] }), ctx);

    expect(deleteManyMock).toHaveBeenCalledWith({ where: { id: { in: ["e1", "e2"] }, courseId: "c1" } });
  });

  it("advances abonements by one month, capped, skipping whole-course rows", async () => {
    findManyMock.mockResolvedValue([
      { id: "e1", accessThroughModule: 1 },
      { id: "e2", accessThroughModule: 4 },
      { id: "e3", accessThroughModule: null },
    ]);
    const { POST } = await import("./bulk/route");

    const json = await (await POST(post("/bulk", { action: "advance", ids: ["e1", "e2", "e3"] }), ctx)).json();

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "e1" }, data: { accessThroughModule: 2 } });
    expect(json.updated).toBe(1);
  });

  it("suspends and reactivates", async () => {
    updateManyMock.mockResolvedValue({ count: 2 });
    const { POST } = await import("./bulk/route");

    await POST(post("/bulk", { action: "suspend", ids: ["e1"] }), ctx);
    expect(updateManyMock).toHaveBeenLastCalledWith({ where: { id: { in: ["e1"] }, courseId: "c1" }, data: { status: "SUSPENDED" } });

    await POST(post("/bulk", { action: "activate", ids: ["e1"] }), ctx);
    expect(updateManyMock).toHaveBeenLastCalledWith({
      where: { id: { in: ["e1"] }, courseId: "c1" },
      data: { status: "ACTIVE", completedAt: null },
    });
  });

  it("rejects unknown actions", async () => {
    const { POST } = await import("./bulk/route");
    expect((await POST(post("/bulk", { action: "nuke", ids: ["e1"] }), ctx)).status).toBe(400);
  });
});
