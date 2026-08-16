import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock("@/shared/lib/auth", () => authMock);

const { GET } = await import("./route");
const { resetMetrics, recordFailure } = await import("@/shared/lib/notification-metrics");

beforeEach(() => {
  vi.clearAllMocks();
  resetMetrics();
});

describe("GET /crm/api/admin/notification-health", () => {
  it("returns 401 when there is no session", async () => {
    authMock.getSessionUser.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("returns 403 when the session user is not an admin", async () => {
    authMock.getSessionUser.mockResolvedValue({ id: "u1", email: "t@example.com", role: "TEACHER" });

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it("returns current failure stats for an admin session", async () => {
    authMock.getSessionUser.mockResolvedValue({ id: "u1", email: "a@example.com", role: "ADMIN" });
    recordFailure("telegram", "timeout");

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.channels.telegram.failures).toBe(1);
  });
});
