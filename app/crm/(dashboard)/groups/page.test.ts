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
    group: { findMany: vi.fn().mockResolvedValue([]) },
    student: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("./actions", () => ({ getTeachers: vi.fn().mockResolvedValue([]) }));

const { default: GroupsPage } = await import("./page");

beforeEach(() => vi.clearAllMocks());

describe("CRM groups page guard", () => {
  it("redirects a STUDENT to /access-denied", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "s@x.com", role: "STUDENT" });
    await expect(GroupsPage()).rejects.toThrow("NEXT_REDIRECT:/access-denied");
  });

  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(GroupsPage()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });
});
