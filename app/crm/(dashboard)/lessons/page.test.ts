import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));
vi.mock("@/shared/lib/auth", () => ({ getSessionUser: getSessionUserMock }));
// listLessons and db.* hit the DB; stub them so this test is a pure guard test.
vi.mock("@/crm/lib/services/lesson-list.service", () => ({
  listLessons: vi.fn().mockResolvedValue({ lessons: [], nextCursor: null }),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    group: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    student: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const { default: LessonsPage } = await import("./page");

beforeEach(() => vi.clearAllMocks());

describe("CRM lessons page guard", () => {
  it("redirects a STUDENT to /access-denied, not a thrown RbacError", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "s@x.com", role: "STUDENT" });
    await expect(LessonsPage()).rejects.toThrow("NEXT_REDIRECT:/access-denied");
  });

  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(LessonsPage()).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });
});
