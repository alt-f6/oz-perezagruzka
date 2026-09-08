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
// assertStudentVisibleToTeacher and db hit the DB; stub them so this test is
// a pure guard test.
vi.mock("@/crm/lib/access", () => ({
  assertStudentVisibleToTeacher: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    student: { findUnique: vi.fn() },
    transaction: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    studentExamGoal: { findMany: vi.fn().mockResolvedValue([]) },
    studentExamResult: { findMany: vi.fn().mockResolvedValue([]) },
    parentStudent: { findMany: vi.fn().mockResolvedValue([]) },
    freeze: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn() },
    invite: { findFirst: vi.fn() },
  },
}));

const { default: StudentDetailPage } = await import("./page");

beforeEach(() => vi.clearAllMocks());

describe("CRM student detail page guard", () => {
  it("redirects a STUDENT to /access-denied, not a thrown RbacError", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "s@x.com", role: "STUDENT" });
    await expect(
      StudentDetailPage({ params: Promise.resolve({ id: "student-1" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/access-denied");
  });

  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(
      StudentDetailPage({ params: Promise.resolve({ id: "student-1" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });
});
