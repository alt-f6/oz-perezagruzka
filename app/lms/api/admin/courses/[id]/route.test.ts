import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const courseFindUniqueMock = vi.fn();
const courseUpdateMock = vi.fn();
const userFindUniqueMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    course: {
      findUnique: (...args: unknown[]) => courseFindUniqueMock(...args),
      update: (...args: unknown[]) => courseUpdateMock(...args),
    },
    user: { findUnique: (...args: unknown[]) => userFindUniqueMock(...args) },
  },
}));

const ctx = { params: Promise.resolve({ id: "c1" }) };

function patch(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/courses/c1", { method: "PATCH", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
  courseFindUniqueMock.mockResolvedValue({ id: "c1" });
  courseUpdateMock.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "c1", ...data }));
});

describe("PATCH /api/admin/courses/[id]", () => {
  it("updates only the facets present in the body", async () => {
    const { PATCH } = await import("./route");

    const res = await PATCH(patch({ subject: "Математика", exam_type: "ege" }), ctx);

    expect(courseUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" }, data: { subject: "Математика", examType: "EGE" } }),
    );
    expect((await res.json()).ok).toBe(true);
  });

  it("rejects a subject outside the shared vocabulary", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patch({ subject: "Math" }), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_subject");
    expect(courseUpdateMock).not.toHaveBeenCalled();
  });

  it("assigns a teacher owner", async () => {
    userFindUniqueMock.mockResolvedValue({ role: "TEACHER", isArchived: false });
    const { PATCH } = await import("./route");

    await PATCH(patch({ teacher_id: "t1" }), ctx);

    expect(courseUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ data: { teacherId: "t1" } }));
  });

  it.each([
    [{ role: "STUDENT", isArchived: false }],
    [{ role: "TEACHER", isArchived: true }],
    [null],
  ])("refuses a non-staff, archived or missing owner (%o)", async (owner) => {
    userFindUniqueMock.mockResolvedValue(owner);
    const { PATCH } = await import("./route");

    const res = await PATCH(patch({ teacher_id: "u1" }), ctx);

    expect(res.status).toBe(400);
    expect(courseUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects an empty title and 404s an unknown course", async () => {
    const { PATCH } = await import("./route");
    expect((await PATCH(patch({ title: "  " }), ctx)).status).toBe(400);

    courseFindUniqueMock.mockResolvedValue(null);
    expect((await PATCH(patch({ is_published: true }), ctx)).status).toBe(404);
  });
});
