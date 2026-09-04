import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Unwrap the API guard so we exercise the handler logic directly.
vi.mock("@/lms/server/http/api-guard", () => ({
  withApiErrors: (h: unknown) => h,
}));

const inviteFindFirst = vi.fn();
const inviteUpdate = vi.fn();
const userFindUnique = vi.fn();
const transaction = vi.fn();
vi.mock("@/shared/lib/db", () => ({
  db: {
    invite: {
      findFirst: (...a: unknown[]) => inviteFindFirst(...a),
      update: (...a: unknown[]) => inviteUpdate(...a),
    },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

vi.mock("@/shared/lib/auth", () => ({
  hashPassword: async () => "hashed",
  createUserSession: async () => ({ token: "sess", expiresAt: new Date() }),
  signToken: (t: string) => `signed:${t}`,
  SESSION_COOKIE_NAME: "session",
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: vi.fn() }),
}));

function getReq(token: string) {
  return new NextRequest(`http://crm.localhost/api/auth/register?token=${token}`);
}

function postReq(body: object) {
  return new NextRequest("http://crm.localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const future = () => new Date(Date.now() + 60_000);

describe("register route — invite lifecycle", () => {
  beforeEach(() => {
    inviteFindFirst.mockReset();
    inviteUpdate.mockReset();
    userFindUnique.mockReset();
    transaction.mockReset();
  });

  it("GET returns 404 for a genuinely unknown token", async () => {
    inviteFindFirst.mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET(getReq("nope"));
    expect(res.status).toBe(404);
  });

  it("GET routes an already-accepted invite to login instead of a dead end", async () => {
    inviteFindFirst.mockResolvedValue({
      id: "i1",
      email: "s@x.com",
      role: "STUDENT",
      acceptedAt: new Date(),
      expiresAt: future(),
    });
    const { GET } = await import("./route");
    const res = await GET(getReq("used"));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json).toMatchObject({ ok: false, alreadyAccepted: true, loginPath: "/admin/login" });
  });

  it("GET returns ok for a valid pending invite (read-only, does not consume it)", async () => {
    inviteFindFirst.mockResolvedValue({
      id: "i1",
      email: "s@x.com",
      role: "STUDENT",
      acceptedAt: null,
      expiresAt: future(),
    });
    const { GET } = await import("./route");
    const res = await GET(getReq("good"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    // A preview GET must never write to the invite.
    expect(inviteUpdate).not.toHaveBeenCalled();
  });

  it("POST on an already-accepted invite returns the login hand-off, not account creation", async () => {
    inviteFindFirst.mockResolvedValue({
      id: "i1",
      email: "s@x.com",
      role: "STUDENT",
      studentId: "st1",
      acceptedAt: new Date(),
      expiresAt: future(),
    });
    const { POST } = await import("./route");
    const res = await POST(postReq({ token: "used", name: "Иван Иванов", password: "secret1" }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json).toMatchObject({ alreadyAccepted: true, loginPath: "/admin/login" });
    // Must not have attempted to create/link an account.
    expect(transaction).not.toHaveBeenCalled();
  });
});
