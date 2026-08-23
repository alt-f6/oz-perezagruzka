import { describe, it, expect, vi, beforeEach } from "vitest";

const findUniqueMock = vi.fn();
const findManyMock = vi.fn();
const upsertMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock("@/shared/lib/db", () => ({
  db: {
    loginAttempt: {
      findUnique: (...a: unknown[]) => findUniqueMock(...a),
      findMany: (...a: unknown[]) => findManyMock(...a),
      upsert: (...a: unknown[]) => upsertMock(...a),
      deleteMany: (...a: unknown[]) => deleteManyMock(...a),
    },
  },
}));

describe("isLoginRateLimited", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    findManyMock.mockReset();
  });

  it("returns false when there is no prior attempt row", async () => {
    findUniqueMock.mockResolvedValue(null);
    findManyMock.mockResolvedValue([]);
    const { isLoginRateLimited } = await import("./login-rate-limit");

    await expect(isLoginRateLimited("1.2.3.4", "a@x.com")).resolves.toBe(false);
  });

  it("returns true when the same (ip, email) has hit the per-IP cap within the window", async () => {
    findUniqueMock.mockResolvedValue({ attemptCount: 5, lastAttempt: new Date() });
    findManyMock.mockResolvedValue([]);
    const { isLoginRateLimited } = await import("./login-rate-limit");

    await expect(isLoginRateLimited("1.2.3.4", "a@x.com")).resolves.toBe(true);
  });

  it("returns true when the email-wide aggregate across IPs hits the cap, even with no single-IP hit", async () => {
    findUniqueMock.mockResolvedValue(null);
    findManyMock.mockResolvedValue(Array.from({ length: 20 }, () => ({ attemptCount: 1 })));
    const { isLoginRateLimited } = await import("./login-rate-limit");

    await expect(isLoginRateLimited("1.2.3.4", "a@x.com")).resolves.toBe(true);
  });
});

describe("clearLoginAttempts", () => {
  it("clears all attempts for the email across every IP", async () => {
    const { clearLoginAttempts } = await import("./login-rate-limit");
    await clearLoginAttempts("a@x.com");

    expect(deleteManyMock).toHaveBeenCalledWith({ where: { email: "a@x.com" } });
  });
});

describe("recordFailedLoginAttempt", () => {
  it("upserts the (ip, email) row, incrementing attemptCount", async () => {
    const { recordFailedLoginAttempt } = await import("./login-rate-limit");
    await recordFailedLoginAttempt("1.2.3.4", "a@x.com");

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ipAddress_email: { ipAddress: "1.2.3.4", email: "a@x.com" } },
      }),
    );
  });
});
