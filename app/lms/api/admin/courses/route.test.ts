import { describe, it, expect, vi, beforeEach } from "vitest";

const requireRoleMock = vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" });
const findManyCourseMock = vi.fn();
const createCourseMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({ requireRole: (...args: unknown[]) => requireRoleMock(...args) }));
vi.mock("@/shared/lib/db", () => ({
  db: { course: { findMany: (...a: unknown[]) => findManyCourseMock(...a), create: (...a: unknown[]) => createCourseMock(...a) } },
}));

describe("GET /api/admin/courses", () => {
  beforeEach(() => {
    requireRoleMock.mockClear();
    findManyCourseMock.mockReset();
    createCourseMock.mockReset();
  });

  it("lists courses ordered by title", async () => {
    findManyCourseMock.mockResolvedValue([{ id: "c1", title: "Базовый курс", isPublished: true }]);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://test/api/admin/courses") as never);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.courses).toEqual([{ id: "c1", title: "Базовый курс", isPublished: true }]);
  });

  it("creates a course with the given title", async () => {
    createCourseMock.mockResolvedValue({ id: "c2", title: "Новый курс", isPublished: false });
    const { POST } = await import("./route");

    const req = new Request("http://test/api/admin/courses", {
      method: "POST",
      body: JSON.stringify({ title: "Новый курс" }),
    });
    const res = await POST(req as never);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(createCourseMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: "Новый курс", teacherId: "admin-1" }) })
    );
  });
});
