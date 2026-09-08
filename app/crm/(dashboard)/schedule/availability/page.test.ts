import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));
vi.mock("@/shared/lib/auth", () => ({ getSessionUser: getSessionUserMock }));
// db.user.findMany hits the DB; stub it so this test is a pure guard test.
vi.mock("@/shared/lib/db", () => ({
  db: {
    user: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const { default: AvailabilityPage } = await import("./page");

beforeEach(() => vi.clearAllMocks());

describe("CRM schedule availability page guard", () => {
  it("redirects a STUDENT to /access-denied, not a thrown RbacError", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "s@x.com", role: "STUDENT" });
    await expect(AvailabilityPage()).rejects.toThrow("NEXT_REDIRECT:/access-denied");
  });

  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(AvailabilityPage()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });
});
