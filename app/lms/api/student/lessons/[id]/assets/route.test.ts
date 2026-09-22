import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const findManyMock = vi.fn();
const canViewLessonMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lessonAsset: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));
vi.mock("@/lms/server/access/can-view-lesson", () => ({
  canViewLesson: (...args: unknown[]) => canViewLessonMock(...args),
}));

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const assetRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "asset_1",
  kind: "pdf",
  title: "Homework",
  originalName: "homework.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  order: 1,
  isPublic: true,
  ...overrides,
});

beforeEach(() => {
  requireRoleMock.mockReset();
  findManyMock.mockReset();
  canViewLessonMock.mockReset();
});

describe("GET /api/student/lessons/[id]/assets", () => {
  it("returns ok:true with mapped items for a TEACHER once canViewLesson allows it", async () => {
    // requireRole was widened from ["STUDENT"] to LMS_ROLES so staff can reach
    // the canViewLesson gate below (which owns the ADMIN/MANAGER/TEACHER bypass).
    requireRoleMock.mockResolvedValue({ id: "teacher_1", role: "TEACHER" });
    canViewLessonMock.mockResolvedValue(true);
    findManyMock.mockResolvedValue([assetRow()]);
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/student/lessons/lesson_1/assets"), makeCtx("lesson_1"));
    const json = await res.json();

    expect(canViewLessonMock).toHaveBeenCalledWith({ userId: "teacher_1", role: "TEACHER", lessonId: "lesson_1" });
    expect(findManyMock).toHaveBeenCalledWith({
      where: { lessonId: "lesson_1", isPublic: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: {
        id: true,
        kind: true,
        title: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        order: true,
        isPublic: true,
      },
    });
    expect(res.status).toBe(200);
    expect(json).toEqual({
      ok: true,
      items: [
        {
          id: "asset_1",
          kind: "pdf",
          title: "Homework",
          original_name: "homework.pdf",
          mime_type: "application/pdf",
          size_bytes: 1024,
          order: 1,
          is_public: true,
        },
      ],
    });
  });

  it("returns 403 for a STUDENT when canViewLesson denies access", async () => {
    requireRoleMock.mockResolvedValue({ id: "student_1", role: "STUDENT" });
    canViewLessonMock.mockResolvedValue(false);
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/student/lessons/lesson_1/assets"), makeCtx("lesson_1"));
    const json = await res.json();

    expect(canViewLessonMock).toHaveBeenCalledWith({ userId: "student_1", role: "STUDENT", lessonId: "lesson_1" });
    expect(res.status).toBe(403);
    expect(json).toEqual({ ok: false, error: "forbidden" });
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
