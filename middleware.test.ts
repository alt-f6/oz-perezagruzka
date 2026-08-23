import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const hasSignedSessionCookieMock = vi.fn();

vi.mock("@/shared/lib/auth", () => ({
  hasSignedSessionCookie: (...args: unknown[]) => hasSignedSessionCookieMock(...args),
}));

describe("middleware", () => {
  beforeEach(() => {
    hasSignedSessionCookieMock.mockReset();
  });

  it("allows public auth prefixes through without checking the cookie", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/crm/api/auth/login", { method: "POST" });

    const res = middleware(req);

    expect(hasSignedSessionCookieMock).not.toHaveBeenCalled();
    expect(res.status).not.toBe(401);
  });

  it("allows the CRM login page through", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/crm/login");
    const res = middleware(req);
    expect(res.status).not.toBe(401);
  });

  it("allows LMS webhook-free public prefixes through, e.g. /lms/login", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/lms/login");
    const res = middleware(req);
    expect(res.status).not.toBe(401);
  });

  it("returns 401 JSON for an unauthenticated /crm/api/** request outside the allow-list", async () => {
    hasSignedSessionCookieMock.mockReturnValue(false);
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/crm/api/admin/notification-health");

    const res = middleware(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "unauthorized" });
  });

  it("redirects an unauthenticated /crm/dashboard page request to /crm/login", async () => {
    hasSignedSessionCookieMock.mockReturnValue(false);
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/crm/students");

    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/crm/login");
  });

  it("redirects an unauthenticated /lms/** page request to /lms/login", async () => {
    hasSignedSessionCookieMock.mockReturnValue(false);
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/lms/student");

    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/lms/login");
  });

  it("passes through an authenticated /crm/api/** request", async () => {
    hasSignedSessionCookieMock.mockReturnValue(true);
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/crm/api/admin/notification-health");

    const res = middleware(req);

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(307);
  });

  it("allows /crm/api/webhooks/** through without a session (signature-verified separately)", async () => {
    const { middleware } = await import("./middleware");
    const req = new NextRequest("http://localhost/crm/api/webhooks/yookassa", { method: "POST" });

    const res = middleware(req);

    expect(hasSignedSessionCookieMock).not.toHaveBeenCalled();
    expect(res.status).not.toBe(401);
  });
});
