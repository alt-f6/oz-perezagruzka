import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const updateManyMock = vi.fn();
const findManyMock = vi.fn();
const updateMock = vi.fn();
const aggregateMock = vi.fn();
const moduleFindUniqueMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => {
  const lesson = {
    updateMany: (...args: unknown[]) => updateManyMock(...args),
    findMany: (...args: unknown[]) => findManyMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    aggregate: (...args: unknown[]) => aggregateMock(...args),
  };
  return {
    db: {
      lesson,
      module: { findUnique: (...args: unknown[]) => moduleFindUniqueMock(...args) },
      $transaction: (fn: (tx: unknown) => unknown) => fn({ lesson }),
    },
  };
});

function post(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/lessons/bulk", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
});

describe("POST /api/admin/lessons/bulk", () => {
  it("is restricted to ADMIN/MANAGER", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    const { POST } = await import("./route");
    await POST(post({ action: "publish", ids: ["l1"] }));
    expect(requireRoleMock).toHaveBeenCalledWith(["ADMIN", "MANAGER"], { adminBypass: true });
  });

  it("publishes the given (deduped) ids", async () => {
    updateManyMock.mockResolvedValue({ count: 2 });
    const { POST } = await import("./route");

    const res = await POST(post({ action: "publish", ids: ["l1", "l2", "l1"] }));

    expect(updateManyMock).toHaveBeenCalledWith({ where: { id: { in: ["l1", "l2"] } }, data: { isPublished: true } });
    expect(await res.json()).toEqual({ ok: true, updated: 2 });
  });

  it("unpublishes", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    const { POST } = await import("./route");
    await POST(post({ action: "unpublish", ids: ["l1"] }));
    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({ data: { isPublished: false } }));
  });

  it("rejects unknown actions and empty id lists", async () => {
    const { POST } = await import("./route");
    expect((await POST(post({ action: "delete", ids: ["l1"] }))).status).toBe(400);
    expect((await POST(post({ action: "publish", ids: [] }))).status).toBe(400);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("moves lessons to the end of the target module, numbering them sequentially", async () => {
    moduleFindUniqueMock.mockResolvedValue({ id: "m2" });
    findManyMock.mockResolvedValue([{ id: "l3" }, { id: "l1" }]);
    aggregateMock.mockResolvedValue({ _max: { order: 5 } });
    const { POST } = await import("./route");

    const res = await POST(post({ action: "move", ids: ["l1", "l3"], module_id: "m2" }));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["l1", "l3"] }, moduleId: { not: "m2" } } }),
    );
    expect(updateMock).toHaveBeenNthCalledWith(1, { where: { id: "l3" }, data: { moduleId: "m2", order: 6 } });
    expect(updateMock).toHaveBeenNthCalledWith(2, { where: { id: "l1" }, data: { moduleId: "m2", order: 7 } });
    expect(await res.json()).toEqual({ ok: true, updated: 2 });
  });

  it("requires an existing target module for move", async () => {
    const { POST } = await import("./route");
    expect((await POST(post({ action: "move", ids: ["l1"] }))).status).toBe(400);

    moduleFindUniqueMock.mockResolvedValue(null);
    const res = await POST(post({ action: "move", ids: ["l1"], module_id: "nope" }));
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
