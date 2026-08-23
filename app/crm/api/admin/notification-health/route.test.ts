import { describe, it, expect, vi, beforeEach } from "vitest";

const getSessionUserMock = vi.fn();
vi.mock("@/shared/lib/auth", () => ({
  getSessionUser: (...args: unknown[]) => getSessionUserMock(...args),
}));
vi.mock("@/shared/lib/notification-metrics", () => ({
  getStats: () => ({ failures: 0 }),
}));

describe("GET /crm/api/admin/notification-health", () => {
  beforeEach(() => getSessionUserMock.mockReset());

  it("returns 401 when unauthenticated", async () => {
    getSessionUserMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-ADMIN role", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "MANAGER", email: "m@x.com" });
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns stats for ADMIN", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", role: "ADMIN", email: "a@x.com" });
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ failures: 0 });
  });
});
