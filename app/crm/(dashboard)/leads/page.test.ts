import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));
vi.mock("@/shared/lib/auth", () => ({ getSessionUser: getSessionUserMock }));
vi.mock("@/shared/lib/db", () => ({
  db: { lead: { findMany: vi.fn().mockResolvedValue([]) } },
}));

const { default: LeadsPage } = await import("./page");

beforeEach(() => vi.clearAllMocks());

describe("CRM leads page guard", () => {
  it("redirects a TEACHER to /access-denied", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "t@x.com", role: "TEACHER" });
    await expect(LeadsPage()).rejects.toThrow("NEXT_REDIRECT:/access-denied");
  });

  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(LeadsPage()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });
});
