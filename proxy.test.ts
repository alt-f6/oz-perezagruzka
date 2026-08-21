import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const authMocks = vi.hoisted(() => ({
  getSessionUserFromRequest: vi.fn(),
}));

vi.mock("@/shared/lib/auth", () => ({
  CRM_ROLES: ["ADMIN", "MANAGER", "TEACHER"],
  LMS_ROLES: ["ADMIN", "MANAGER", "TEACHER", "STUDENT"],
  getSessionUserFromRequest: authMocks.getSessionUserFromRequest,
}));

const { proxy } = await import("./proxy");

function makeRequest(host: string, pathname: string) {
  return new NextRequest(`https://${host}${pathname}`, {
    headers: { host },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.getSessionUserFromRequest.mockResolvedValue(null);
});

describe("proxy fail-closed routing", () => {
  it("redirects an unauthenticated request to a brand-new, unlisted CRM path to login", async () => {
    const res = await proxy(makeRequest("crm.example.com", "/reports"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/admin/login");
  });

  it("redirects an unauthenticated request to a brand-new, unlisted LMS path to login", async () => {
    const res = await proxy(makeRequest("lms.example.com", "/gradebook"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("allows an authenticated CRM staff user through to a new, unlisted path", async () => {
    authMocks.getSessionUserFromRequest.mockResolvedValue({ id: "u1", role: "ADMIN" });

    const res = await proxy(makeRequest("crm.example.com", "/reports"));

    expect(res.status).not.toBe(307);
  });

  it("keeps the CRM register page public without a session", async () => {
    const res = await proxy(makeRequest("crm.example.com", "/register"));

    expect(res.status).not.toBe(307);
    expect(authMocks.getSessionUserFromRequest).not.toHaveBeenCalled();
  });

  it("keeps CRM auth API routes public without a session", async () => {
    const res = await proxy(makeRequest("crm.example.com", "/api/auth/login"));

    expect(res.status).not.toBe(307);
    expect(authMocks.getSessionUserFromRequest).not.toHaveBeenCalled();
  });

  it("keeps static asset requests (file extension) unauthenticated", async () => {
    const res = await proxy(makeRequest("lms.example.com", "/pdf.worker.min.mjs"));

    expect(res.status).not.toBe(307);
    expect(authMocks.getSessionUserFromRequest).not.toHaveBeenCalled();
  });

  it("keeps the LMS login page public", async () => {
    const res = await proxy(makeRequest("lms.example.com", "/login"));

    expect(res.status).not.toBe(307);
  });
});
