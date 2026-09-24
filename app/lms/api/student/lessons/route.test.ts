import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const getAccessibleLessonsMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/lms/server/student/accessible-lessons", () => ({
  getAccessibleLessons: (...args: unknown[]) => getAccessibleLessonsMock(...args),
}));

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/api/student/lessons${query}`);
}

const lesson = (id: string, completedAt: Date | null = null) => ({
  id,
  title: `Lesson ${id}`,
  description: "",
  order: 1,
  courseTitle: "Курс",
  moduleTitle: "Модуль",
  completedAt,
  started: false,
  source: "course" as const,
});

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({ id: "student_1", role: "STUDENT" });
});

describe("GET /api/student/lessons", () => {
  it("returns the accessible lessons for the signed-in student with course/module context", async () => {
    getAccessibleLessonsMock.mockResolvedValue([lesson("l1", new Date("2026-09-01T00:00:00Z"))]);
    const { GET } = await import("./route");

    const json = await (await GET(makeRequest())).json();

    expect(getAccessibleLessonsMock).toHaveBeenCalledWith("student_1");
    expect(json.lessons).toEqual([
      {
        id: "l1",
        title: "Lesson l1",
        description: "",
        order: 1,
        course_title: "Курс",
        module_title: "Модуль",
        completed_at: "2026-09-01T00:00:00.000Z",
      },
    ]);
    expect(json.nextCursor).toBeNull();
  });

  it("pages by lesson id", async () => {
    getAccessibleLessonsMock.mockResolvedValue([lesson("l1"), lesson("l2"), lesson("l3")]);
    const { GET } = await import("./route");

    const first = await (await GET(makeRequest("?limit=2"))).json();
    expect(first.lessons.map((l: { id: string }) => l.id)).toEqual(["l1", "l2"]);
    expect(first.nextCursor).toBe("l2");

    const second = await (await GET(makeRequest("?limit=2&cursor=l2"))).json();
    expect(second.lessons.map((l: { id: string }) => l.id)).toEqual(["l3"]);
    expect(second.nextCursor).toBeNull();
  });

  it("returns an empty page for an unknown cursor instead of restarting", async () => {
    getAccessibleLessonsMock.mockResolvedValue([lesson("l1")]);
    const { GET } = await import("./route");

    const json = await (await GET(makeRequest("?cursor=gone"))).json();
    expect(json.lessons).toEqual([]);
    expect(json.nextCursor).toBeNull();
  });
});
