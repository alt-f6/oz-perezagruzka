import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/shared/lib/auth", () => ({ getSessionUser: getSessionUserMock }));
// db hits the DB; stub it so this test is a pure guard test.
vi.mock("@/shared/lib/db", () => ({
  db: {
    classSession: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    groupStudent: { findMany: vi.fn().mockResolvedValue([]) },
    attendance: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const { default: LessonDetailPage } = await import("./page");

beforeEach(() => vi.clearAllMocks());

describe("CRM lesson detail page guard", () => {
  it("redirects a STUDENT to /access-denied, not a thrown RbacError", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "s@x.com", role: "STUDENT" });
    await expect(
      LessonDetailPage({ params: Promise.resolve({ id: "lesson-1" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/access-denied");
  });

  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(
      LessonDetailPage({ params: Promise.resolve({ id: "lesson-1" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });
});
