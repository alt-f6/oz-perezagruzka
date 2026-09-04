import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const headersMock = vi.fn();
const listStudentsMock = vi.fn();
const listLessonsMock = vi.fn();
const listAssignmentsForStudentMock = vi.fn();
const listAssignedStudentIdsForLessonMock = vi.fn();
const grantLessonMock = vi.fn();
const revokeLessonMock = vi.fn();
const setAssignmentsForStudentMock = vi.fn();
const setAssignmentsForLessonMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));
vi.mock("@/lms/server/repos/assignments.repo", () => ({
  listStudents: (...args: unknown[]) => listStudentsMock(...args),
  listLessons: (...args: unknown[]) => listLessonsMock(...args),
  listAssignmentsForStudent: (...args: unknown[]) => listAssignmentsForStudentMock(...args),
  listAssignedStudentIdsForLesson: (...args: unknown[]) => listAssignedStudentIdsForLessonMock(...args),
  grantLesson: (...args: unknown[]) => grantLessonMock(...args),
  revokeLesson: (...args: unknown[]) => revokeLessonMock(...args),
  setAssignmentsForStudent: (...args: unknown[]) => setAssignmentsForStudentMock(...args),
  setAssignmentsForLesson: (...args: unknown[]) => setAssignmentsForLessonMock(...args),
}));

function sameOriginHeaders() {
  return new Map([
    ["origin", "http://localhost"],
    ["host", "localhost"],
  ]);
}

function postRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/assignments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireRoleMock.mockReset();
  headersMock.mockReset();
  listStudentsMock.mockReset();
  listLessonsMock.mockReset();
  listAssignmentsForStudentMock.mockReset();
  listAssignedStudentIdsForLessonMock.mockReset();
  grantLessonMock.mockReset();
  revokeLessonMock.mockReset();
  setAssignmentsForStudentMock.mockReset();
  setAssignmentsForLessonMock.mockReset();

  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
  headersMock.mockReturnValue(sameOriginHeaders());
  listStudentsMock.mockResolvedValue([{ id: "stu_1", email: "a@a.com", fullName: "A", role: "STUDENT" }]);
  listLessonsMock.mockResolvedValue([{ id: "lesson_1", title: "L1", isPublished: true, order: 1, module: null }]);
});

describe("GET /api/admin/assignments", () => {
  it("returns assignedStudentIds for the lesson-centric view when lessonId is provided", async () => {
    listAssignedStudentIdsForLessonMock.mockResolvedValue(["stu_1"]);
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/admin/assignments?lessonId=lesson_1"));
    const json = await res.json();

    expect(listAssignedStudentIdsForLessonMock).toHaveBeenCalledWith("lesson_1");
    expect(json.assignedStudentIds).toEqual(["stu_1"]);
    expect(json.assignedLessonIds).toEqual([]);
  });

  it("returns assignedLessonIds for the student-centric view when studentId is provided", async () => {
    listAssignmentsForStudentMock.mockResolvedValue(["lesson_1"]);
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/admin/assignments?studentId=stu_1"));
    const json = await res.json();

    expect(json.assignedLessonIds).toEqual(["lesson_1"]);
    expect(json.assignedStudentIds).toEqual([]);
  });
});

describe("POST /api/admin/assignments — setForLesson", () => {
  it("replaces the full set of students assigned to a lesson", async () => {
    setAssignmentsForLessonMock.mockResolvedValue(undefined);
    const { POST } = await import("./route");

    const res = await POST(postRequest({ action: "setForLesson", lessonId: "lesson_1", studentIds: ["stu_1", "stu_2"] }));
    const json = await res.json();

    expect(setAssignmentsForLessonMock).toHaveBeenCalledWith("lesson_1", ["stu_1", "stu_2"]);
    expect(json.ok).toBe(true);
  });

  it("requires a lessonId", async () => {
    const { POST } = await import("./route");

    const res = await POST(postRequest({ action: "setForLesson", studentIds: [] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("lessonId required");
    expect(setAssignmentsForLessonMock).not.toHaveBeenCalled();
  });

  it("rejects a non-array studentIds payload", async () => {
    const { POST } = await import("./route");

    const res = await POST(postRequest({ action: "setForLesson", lessonId: "lesson_1", studentIds: "not-an-array" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("studentIds must be array");
  });

  it("rejects cross-origin requests", async () => {
    headersMock.mockReturnValue(
      new Map([
        ["origin", "http://evil.example"],
        ["host", "localhost"],
      ])
    );
    const { POST } = await import("./route");

    const res = await POST(postRequest({ action: "setForLesson", lessonId: "lesson_1", studentIds: [] }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("forbidden");
    expect(setAssignmentsForLessonMock).not.toHaveBeenCalled();
  });
});
