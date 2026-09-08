import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));
vi.mock("@/shared/lib/auth", () => ({ getSessionUser: getSessionUserMock }));
vi.mock("./actions", () => ({
  getTeacherRates: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getTeacherPayouts: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));
vi.mock("@/shared/lib/db", () => ({ db: { user: { findMany: vi.fn().mockResolvedValue([]) } } }));

const { default: SalaryPage } = await import("./page");

beforeEach(() => vi.clearAllMocks());

describe("CRM salary page guard", () => {
  it("redirects a MANAGER (not ADMIN) to /access-denied", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "m@x.com", role: "MANAGER" });
    await expect(SalaryPage()).rejects.toThrow("NEXT_REDIRECT:/access-denied");
  });

  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(SalaryPage()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });
});
