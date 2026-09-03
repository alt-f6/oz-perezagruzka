import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.hoisted(() => vi.fn());

// redirect() throws a sentinel so control flow stops, mirroring Next.js.
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));
vi.mock("@/shared/lib/auth", () => ({ getSessionUser: getSessionUserMock }));

const { default: LmsRootPage } = await import("./page");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LMS root page (SEC-02)", () => {
  it("redirects an unauthenticated visitor to /login (not a 404)", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(LmsRootPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("routes a STUDENT to their dashboard", async () => {
    getSessionUserMock.mockResolvedValue({ id: "s1", email: null, role: "STUDENT" });
    await expect(LmsRootPage()).rejects.toThrow("NEXT_REDIRECT:/student");
  });

  it("routes staff (ADMIN/MANAGER/TEACHER) to the admin dashboard", async () => {
    for (const role of ["ADMIN", "MANAGER", "TEACHER"] as const) {
      getSessionUserMock.mockResolvedValue({ id: "u1", email: null, role });
      await expect(LmsRootPage()).rejects.toThrow("NEXT_REDIRECT:/admin");
    }
  });
});
