import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.hoisted(() => vi.fn());

// redirect() throws a sentinel so control flow stops, mirroring Next.js.
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));
// CRM_ROLES is exported alongside getSessionUser from @/shared/lib/auth, so
// it must be mocked explicitly here too (mirrors proxy.test.ts) — otherwise
// the layout's import of CRM_ROLES resolves to undefined.
vi.mock("@/shared/lib/auth", () => ({
  CRM_ROLES: ["ADMIN", "MANAGER", "TEACHER"],
  getSessionUser: getSessionUserMock,
}));

const { default: DashboardLayout } = await import("./layout");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CRM (dashboard) layout guard", () => {
  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(DashboardLayout({ children: null })).rejects.toThrow(
      "NEXT_REDIRECT:/admin/login",
    );
  });

  it("redirects a STUDENT (wrong role) to /access-denied, not to login", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "s@x.com", role: "STUDENT" });
    await expect(DashboardLayout({ children: null })).rejects.toThrow(
      "NEXT_REDIRECT:/access-denied",
    );
  });

  it("does not throw or redirect for an authorized ADMIN", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "a@x.com", role: "ADMIN" });
    await expect(DashboardLayout({ children: "content" })).resolves.toBeTruthy();
  });
});
