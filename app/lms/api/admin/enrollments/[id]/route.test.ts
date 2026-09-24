import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    enrollment: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      deleteMany: (...args: unknown[]) => deleteManyMock(...args),
    },
  },
}));

const ctx = { params: Promise.resolve({ id: "e1" }) };
const patch = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/enrollments/e1", { method: "PATCH", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
  findUniqueMock.mockResolvedValue({ id: "e1", course: { _count: { modules: 3 } } });
  updateMock.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "e1", ...data }));
});

describe("PATCH /api/admin/enrollments/[id]", () => {
  it("sets the abonement cursor within the course length", async () => {
    const { PATCH } = await import("./route");

    await PATCH(patch({ access_through_module: 2 }), ctx);
    expect(updateMock).toHaveBeenLastCalledWith(expect.objectContaining({ data: { accessThroughModule: 2 } }));

    await PATCH(patch({ access_through_module: null }), ctx);
    expect(updateMock).toHaveBeenLastCalledWith(expect.objectContaining({ data: { accessThroughModule: null } }));
  });

  it("rejects a cursor beyond the course and unknown statuses", async () => {
    const { PATCH } = await import("./route");
    expect((await PATCH(patch({ access_through_module: 4 }), ctx)).status).toBe(400);
    expect((await PATCH(patch({ status: "BANNED" }), ctx)).status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("stamps completedAt only when completing", async () => {
    const { PATCH } = await import("./route");

    await PATCH(patch({ status: "COMPLETED" }), ctx);
    expect(updateMock.mock.lastCall?.[0].data.completedAt).toBeInstanceOf(Date);

    await PATCH(patch({ status: "ACTIVE" }), ctx);
    expect(updateMock.mock.lastCall?.[0].data).toEqual({ status: "ACTIVE", completedAt: null });
  });

  it("404s an unknown enrollment", async () => {
    findUniqueMock.mockResolvedValue(null);
    const { PATCH } = await import("./route");
    expect((await PATCH(patch({ status: "ACTIVE" }), ctx)).status).toBe(404);
  });
});

describe("DELETE /api/admin/enrollments/[id]", () => {
  it("deletes, or 404s when missing", async () => {
    const { DELETE } = await import("./route");

    deleteManyMock.mockResolvedValue({ count: 1 });
    expect((await DELETE(new NextRequest("http://localhost/x", { method: "DELETE" }), ctx)).status).toBe(200);

    deleteManyMock.mockResolvedValue({ count: 0 });
    expect((await DELETE(new NextRequest("http://localhost/x", { method: "DELETE" }), ctx)).status).toBe(404);
  });
});
