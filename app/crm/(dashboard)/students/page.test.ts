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
  db: { group: { findMany: vi.fn().mockResolvedValue([]) } },
}));
vi.mock("@/crm/lib/services/student-list.service", () => ({
  listStudents: vi.fn().mockResolvedValue({ students: [], nextCursor: null }),
}));

const { default: StudentsPage } = await import("./page");

beforeEach(() => vi.clearAllMocks());

describe("CRM students list page guard", () => {
  it("redirects a STUDENT to /access-denied", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "s@x.com", role: "STUDENT" });
    await expect(StudentsPage()).rejects.toThrow("NEXT_REDIRECT:/access-denied");
  });

  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(StudentsPage()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });
});
