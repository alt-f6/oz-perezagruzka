import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const isLoginRateLimitedMock = vi.fn();
const recordFailedLoginAttemptMock = vi.fn();
const clearLoginAttemptsMock = vi.fn();
vi.mock("@/shared/lib/login-rate-limit", () => ({
  isLoginRateLimited: (...a: unknown[]) => isLoginRateLimitedMock(...a),
  recordFailedLoginAttempt: (...a: unknown[]) => recordFailedLoginAttemptMock(...a),
  clearLoginAttempts: (...a: unknown[]) => clearLoginAttemptsMock(...a),
}));

const authenticateMock = vi.fn();
const createUserSessionMock = vi.fn();
vi.mock("@/shared/lib/auth", () => ({
  authenticateWithPassword: (...a: unknown[]) => authenticateMock(...a),
  createUserSession: (...a: unknown[]) => createUserSessionMock(...a),
  signToken: (t: string) => `signed:${t}`,
  SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/shared/lib/logger", () => ({
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

// `cookies()` from next/headers requires Next's request-scope machinery,
// which isn't present when a route handler is invoked directly in a unit
// test (only through Next's own dev/prod server). Mock it with a fake jar
// so we can assert on the exact options passed to `.set()` instead.
const cookieSetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSetMock }),
}));

function loginRequest(body: object) {
  return new NextRequest("http://localhost/crm/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

describe("POST /crm/api/auth/login", () => {
  beforeEach(() => {
    isLoginRateLimitedMock.mockReset().mockResolvedValue(false);
    recordFailedLoginAttemptMock.mockReset();
    clearLoginAttemptsMock.mockReset();
    authenticateMock.mockReset();
    createUserSessionMock.mockReset().mockResolvedValue({ token: "tok", expiresAt: new Date() });
    cookieSetMock.mockReset();
  });

  it("returns 429 when rate limited", async () => {
    isLoginRateLimitedMock.mockResolvedValue(true);
    const { POST } = await import("./route");
    const res = await POST(loginRequest({ email: "a@x.com", password: "x" }));
    expect(res.status).toBe(429);
  });

  it("returns 401 and records a failed attempt on bad credentials", async () => {
    authenticateMock.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(loginRequest({ email: "a@x.com", password: "wrong" }));
    expect(res.status).toBe(401);
    expect(recordFailedLoginAttemptMock).toHaveBeenCalledWith("1.2.3.4", "a@x.com");
  });

  it("clears login attempts and returns the role on success", async () => {
    authenticateMock.mockResolvedValue({ id: "u1", role: "ADMIN", email: "a@x.com" });
    const { POST } = await import("./route");
    const res = await POST(loginRequest({ email: "a@x.com", password: "correct" }));
    expect(res.status).toBe(200);
    expect(clearLoginAttemptsMock).toHaveBeenCalledWith("a@x.com");
    const json = await res.json();
    expect(json).toEqual({ ok: true, role: "ADMIN" });
  });

  it("sets a session cookie with domain=COOKIE_DOMAIN when the env var is set", async () => {
    const originalDomain = process.env.COOKIE_DOMAIN;
    process.env.COOKIE_DOMAIN = ".oz-perezagruzka.ru";
    authenticateMock.mockResolvedValue({ id: "u1", role: "ADMIN", email: "a@x.com" });
    const { POST } = await import("./route");

    await POST(loginRequest({ email: "a@x.com", password: "correct" }));

    expect(cookieSetMock).toHaveBeenCalledWith(
      "session",
      expect.any(String),
      expect.objectContaining({ domain: ".oz-perezagruzka.ru" }),
    );
    process.env.COOKIE_DOMAIN = originalDomain;
  });

  it("does not set a Domain attribute when COOKIE_DOMAIN is unset", async () => {
    const originalDomain = process.env.COOKIE_DOMAIN;
    delete process.env.COOKIE_DOMAIN;
    authenticateMock.mockResolvedValue({ id: "u1", role: "ADMIN", email: "a@x.com" });
    const { POST } = await import("./route");

    await POST(loginRequest({ email: "a@x.com", password: "correct" }));

    expect(cookieSetMock).toHaveBeenCalledTimes(1);
    const options = cookieSetMock.mock.calls[0][2];
    expect(options).not.toHaveProperty("domain");
    process.env.COOKIE_DOMAIN = originalDomain;
  });
});
