import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));
vi.mock("@/shared/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
  CRM_ROLES: ["ADMIN", "MANAGER", "TEACHER"],
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    user: { findMany: vi.fn().mockResolvedValue([]) },
    activityLog: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

const { default: AuditPage } = await import("./page");

beforeEach(() => vi.clearAllMocks());

describe("CRM audit page guard", () => {
  it("allows an ADMIN through", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u0", email: "a@x.com", role: "ADMIN" });
    await expect(AuditPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
  });

  it("redirects a MANAGER to /access-denied", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "m@x.com", role: "MANAGER" });
    await expect(AuditPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "NEXT_REDIRECT:/access-denied",
    );
  });

  it("redirects a TEACHER to /access-denied", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u2", email: "t@x.com", role: "TEACHER" });
    await expect(AuditPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "NEXT_REDIRECT:/access-denied",
    );
  });

  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(AuditPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "NEXT_REDIRECT:/admin/login",
    );
  });
});
