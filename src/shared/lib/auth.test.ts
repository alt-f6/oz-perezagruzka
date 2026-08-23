import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueUserMock = vi.fn();
const sessionCreateMock = vi.fn();
const sessionDeleteManyMock = vi.fn();
const sessionFindUniqueMock = vi.fn();

vi.mock("@/shared/lib/db", () => ({
  db: {
    user: {
      findUnique: (...a: unknown[]) => findUniqueUserMock(...a),
    },
    session: {
      create: (...a: unknown[]) => sessionCreateMock(...a),
      deleteMany: (...a: unknown[]) => sessionDeleteManyMock(...a),
      findUnique: (...a: unknown[]) => sessionFindUniqueMock(...a),
    },
  },
}));

const cookiesGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (...a: unknown[]) => cookiesGetMock(...a),
  }),
}));

beforeEach(() => {
  vi.resetModules();
  findUniqueUserMock.mockReset();
  sessionCreateMock.mockReset();
  sessionDeleteManyMock.mockReset();
  sessionFindUniqueMock.mockReset();
  cookiesGetMock.mockReset();
  process.env.COOKIE_SECRET = "a".repeat(32);
});

describe("hashPassword / verifyPassword", () => {
  it("round-trips: verifyPassword returns true for the correct password", async () => {
    const { hashPassword, verifyPassword } = await import("./auth");
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("returns false for a wrong password against a real hash", async () => {
    const { hashPassword, verifyPassword } = await import("./auth");
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });
});

describe("signToken / verifyToken", () => {
  it("verifies a freshly signed token and returns the original payload", async () => {
    const { signToken, verifyToken } = await import("./auth");
    const signed = signToken("some-session-token");

    expect(verifyToken(signed)).toBe("some-session-token");
  });

  it("rejects a tampered signature (flipped signature bytes) without throwing", async () => {
    const { signToken, verifyToken } = await import("./auth");
    const signed = signToken("some-session-token");
    const [token, sig] = signed.split(".");
    // Flip the signature so it no longer matches, but keep it the same length
    // so the length-check in verifyToken can't short-circuit before the
    // timingSafeEqual comparison is exercised.
    const tamperedSig = sig[0] === "0" ? "1" + sig.slice(1) : "0" + sig.slice(1);
    const tampered = `${token}.${tamperedSig}`;

    expect(() => verifyToken(tampered)).not.toThrow();
    expect(verifyToken(tampered)).toBeNull();
  });

  it("rejects a tampered payload (signature no longer matches the token)", async () => {
    const { signToken, verifyToken } = await import("./auth");
    const signed = signToken("some-session-token");
    const [, sig] = signed.split(".");
    const tampered = `different-token.${sig}`;

    expect(verifyToken(tampered)).toBeNull();
  });

  it("rejects malformed input missing the separator, without throwing", async () => {
    const { verifyToken } = await import("./auth");

    expect(() => verifyToken("no-separator-here")).not.toThrow();
    expect(verifyToken("no-separator-here")).toBeNull();
  });

  it("rejects malformed input with too many separators, without throwing", async () => {
    const { verifyToken } = await import("./auth");

    expect(() => verifyToken("a.b.c")).not.toThrow();
    expect(verifyToken("a.b.c")).toBeNull();
  });

  it("rejects a signature of a different length than expected, without throwing", async () => {
    const { signToken, verifyToken } = await import("./auth");
    const signed = signToken("some-session-token");
    const [token] = signed.split(".");
    const shortSig = "abc";

    expect(() => verifyToken(`${token}.${shortSig}`)).not.toThrow();
    expect(verifyToken(`${token}.${shortSig}`)).toBeNull();
  });
});

describe("authenticateWithPassword", () => {
  it("returns the session user on correct credentials", async () => {
    const { hashPassword, authenticateWithPassword } = await import("./auth");
    const passwordHash = await hashPassword("correct-password");
    findUniqueUserMock.mockResolvedValue({
      id: "u1",
      email: "a@x.com",
      role: "ADMIN",
      passwordHash,
      isArchived: false,
    });

    await expect(authenticateWithPassword("a@x.com", "correct-password")).resolves.toEqual({
      id: "u1",
      email: "a@x.com",
      role: "ADMIN",
    });
  });

  it("returns null on wrong password for a real (existing) user", async () => {
    const { hashPassword, authenticateWithPassword } = await import("./auth");
    const passwordHash = await hashPassword("correct-password");
    findUniqueUserMock.mockResolvedValue({
      id: "u1",
      email: "a@x.com",
      role: "ADMIN",
      passwordHash,
      isArchived: false,
    });

    await expect(authenticateWithPassword("a@x.com", "wrong-password")).resolves.toBeNull();
  });

  it("returns null for a nonexistent email without throwing (dummy-hash timing path)", async () => {
    const { authenticateWithPassword } = await import("./auth");
    findUniqueUserMock.mockResolvedValue(null);

    await expect(
      authenticateWithPassword("nobody@x.com", "whatever"),
    ).resolves.toBeNull();
  });

  it("returns null for an archived user, without throwing", async () => {
    const { hashPassword, authenticateWithPassword } = await import("./auth");
    const passwordHash = await hashPassword("correct-password");
    findUniqueUserMock.mockResolvedValue({
      id: "u1",
      email: "a@x.com",
      role: "ADMIN",
      passwordHash,
      isArchived: true,
    });

    await expect(authenticateWithPassword("a@x.com", "correct-password")).resolves.toBeNull();
  });

  it("returns null for a user with no passwordHash set", async () => {
    const { authenticateWithPassword } = await import("./auth");
    findUniqueUserMock.mockResolvedValue({
      id: "u1",
      email: "a@x.com",
      role: "ADMIN",
      passwordHash: null,
      isArchived: false,
    });

    await expect(authenticateWithPassword("a@x.com", "whatever")).resolves.toBeNull();
  });
});

describe("createUserSession", () => {
  it("prunes expired sessions and creates a new session row for the user", async () => {
    const { createUserSession } = await import("./auth");
    sessionDeleteManyMock.mockResolvedValue({ count: 0 });
    sessionCreateMock.mockResolvedValue({});

    const { token, expiresAt } = await createUserSession("u1");

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(expiresAt).toBeInstanceOf(Date);
    expect(sessionDeleteManyMock).toHaveBeenCalledWith({
      where: { expiresAt: { lte: expect.any(Date) } },
    });
    expect(sessionCreateMock).toHaveBeenCalledWith({
      data: { token, userId: "u1", expiresAt },
    });
  });
});

describe("destroySession", () => {
  it("deletes all session rows matching the token", async () => {
    const { destroySession } = await import("./auth");
    sessionDeleteManyMock.mockResolvedValue({ count: 1 });

    await destroySession("some-token");

    expect(sessionDeleteManyMock).toHaveBeenCalledWith({ where: { token: "some-token" } });
  });
});

describe("getSessionUser", () => {
  it("returns null when there is no session cookie", async () => {
    cookiesGetMock.mockReturnValue(undefined);
    const { getSessionUser } = await import("./auth");

    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("returns null when the cookie value fails signature verification", async () => {
    cookiesGetMock.mockReturnValue({ value: "not-a-valid-signed-token" });
    const { getSessionUser } = await import("./auth");

    await expect(getSessionUser()).resolves.toBeNull();
    expect(sessionFindUniqueMock).not.toHaveBeenCalled();
  });

  it("returns the session user for a validly signed, non-expired session", async () => {
    const { signToken, getSessionUser } = await import("./auth");
    const signed = signToken("real-token");
    cookiesGetMock.mockReturnValue({ value: signed });
    sessionFindUniqueMock.mockResolvedValue({
      token: "real-token",
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "u1", email: "a@x.com", role: "TEACHER", isArchived: false },
    });

    await expect(getSessionUser()).resolves.toEqual({ id: "u1", email: "a@x.com", role: "TEACHER" });
  });

  it("returns null for an expired session", async () => {
    const { signToken, getSessionUser } = await import("./auth");
    const signed = signToken("real-token");
    cookiesGetMock.mockReturnValue({ value: signed });
    sessionFindUniqueMock.mockResolvedValue({
      token: "real-token",
      expiresAt: new Date(Date.now() - 60_000),
      user: { id: "u1", email: "a@x.com", role: "TEACHER", isArchived: false },
    });

    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("returns null when the session's user is archived", async () => {
    const { signToken, getSessionUser } = await import("./auth");
    const signed = signToken("real-token");
    cookiesGetMock.mockReturnValue({ value: signed });
    sessionFindUniqueMock.mockResolvedValue({
      token: "real-token",
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "u1", email: "a@x.com", role: "TEACHER", isArchived: true },
    });

    await expect(getSessionUser()).resolves.toBeNull();
  });
});

describe("getSessionUserFromRequest", () => {
  it("returns null when there is no session cookie on the request", async () => {
    const { getSessionUserFromRequest } = await import("./auth");
    const request = { cookies: { get: () => undefined } } as any;
    const response = {} as any;

    await expect(getSessionUserFromRequest(request, response)).resolves.toBeNull();
  });

  it("returns the session user for a validly signed cookie on the request", async () => {
    const { signToken, getSessionUserFromRequest } = await import("./auth");
    const signed = signToken("real-token");
    const request = { cookies: { get: () => ({ value: signed }) } } as any;
    const response = {} as any;
    sessionFindUniqueMock.mockResolvedValue({
      token: "real-token",
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "u1", email: "a@x.com", role: "STUDENT", isArchived: false },
    });

    await expect(getSessionUserFromRequest(request, response)).resolves.toEqual({
      id: "u1",
      email: "a@x.com",
      role: "STUDENT",
    });
  });
});
