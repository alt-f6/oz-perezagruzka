import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserMock = vi.hoisted(() => vi.fn());
const listLessonsPageMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));
vi.mock("@/shared/lib/auth", () => ({
  getSessionUser: getSessionUserMock,
  getUserTimezone: vi.fn().mockResolvedValue("Europe/Moscow"),
}));
vi.mock("@/crm/lib/services/lesson-list.service", () => ({ listLessonsPage: listLessonsPageMock }));
vi.mock("@/shared/lib/db", () => ({
  db: {
    group: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    student: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

const { default: LessonsPage } = await import("./page");

beforeEach(() => {
  vi.clearAllMocks();
  listLessonsPageMock.mockResolvedValue({ lessons: [], total: 0, page: 1, pageSize: 25 });
});

describe("CRM lessons page guard", () => {
  it("redirects a STUDENT to /access-denied, not a thrown RbacError", async () => {
    getSessionUserMock.mockResolvedValue({ id: "u1", email: "s@x.com", role: "STUDENT" });
    await expect(LessonsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT:/access-denied");
  });

  it("redirects an unauthenticated visitor to /admin/login", async () => {
    getSessionUserMock.mockResolvedValue(null);
    await expect(LessonsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT:/admin/login");
  });
});

describe("CRM lessons page data loading", () => {
  it("clears any teacherId filter for a TEACHER session user", async () => {
    getSessionUserMock.mockResolvedValue({ id: "t1", email: "t@x.com", role: "TEACHER" });

    await LessonsPage({ searchParams: Promise.resolve({ teacherId: "550e8400-e29b-41d4-a716-446655440000" }) });

    const call = listLessonsPageMock.mock.calls[0][0];
    expect(call.sessionUser.id).toBe("t1");
    expect(call.filters.teacherId).toBeUndefined();
  });

  it("forwards an explicit teacherId filter for ADMIN", async () => {
    getSessionUserMock.mockResolvedValue({ id: "a1", email: "a@x.com", role: "ADMIN" });

    await LessonsPage({ searchParams: Promise.resolve({ teacherId: "550e8400-e29b-41d4-a716-446655440000" }) });

    const call = listLessonsPageMock.mock.calls[0][0];
    expect(call.filters.teacherId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
