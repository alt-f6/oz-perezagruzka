import { describe, it, expect, vi, beforeEach } from "vitest";

const requireRoleMock = vi.fn().mockResolvedValue({ id: "admin-1", role: "ADMIN" });
const findManyModuleMock = vi.fn();
const createModuleMock = vi.fn();
const aggregateModuleMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({ requireRole: (...args: unknown[]) => requireRoleMock(...args) }));
vi.mock("@/shared/lib/db", () => ({
  db: {
    module: {
      findMany: (...a: unknown[]) => findManyModuleMock(...a),
      create: (...a: unknown[]) => createModuleMock(...a),
      aggregate: (...a: unknown[]) => aggregateModuleMock(...a),
    },
  },
}));

describe("modules route", () => {
  beforeEach(() => {
    findManyModuleMock.mockReset();
    createModuleMock.mockReset();
    aggregateModuleMock.mockReset();
  });

  it("lists modules for a course ordered by order", async () => {
    findManyModuleMock.mockResolvedValue([{ id: "m1", title: "Месяц 1", order: 0, unlockMode: "MANUAL" }]);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://test/api/admin/courses/c1/modules") as never, {
      params: Promise.resolve({ id: "c1" }),
    });
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(findManyModuleMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { courseId: "c1" }, orderBy: { order: "asc" } })
    );
  });

  it("creates a module with drip unlock settings and auto-increments order", async () => {
    aggregateModuleMock.mockResolvedValue({ _max: { order: 2 } });
    createModuleMock.mockResolvedValue({ id: "m2", title: "Месяц 2", order: 3, unlockMode: "DRIP_ENROLLMENT" });
    const { POST } = await import("./route");

    const req = new Request("http://test/api/admin/courses/c1/modules", {
      method: "POST",
      body: JSON.stringify({ title: "Месяц 2", unlockMode: "DRIP_ENROLLMENT", unlockAfterDays: 28 }),
    });
    const res = await POST(req as never, { params: Promise.resolve({ id: "c1" }) });
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(createModuleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ courseId: "c1", title: "Месяц 2", order: 3, unlockMode: "DRIP_ENROLLMENT", unlockAfterDays: 28 }),
      })
    );
  });

  it("rejects an unknown unlockMode", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://test/api/admin/courses/c1/modules", {
      method: "POST",
      body: JSON.stringify({ title: "Месяц 3", unlockMode: "WHENEVER" }),
    });
    const res = await POST(req as never, { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(400);
  });
});
