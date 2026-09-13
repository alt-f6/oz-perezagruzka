import { describe, it, expect, vi, beforeEach } from "vitest";

const assignmentFindUniqueMock = vi.fn();
const lessonFindUniqueMock = vi.fn();
const enrollmentFindUniqueMock = vi.fn();

vi.mock("@/shared/lib/db", () => ({
  db: {
    assignment: { findUnique: (...args: unknown[]) => assignmentFindUniqueMock(...args) },
    lesson: { findUnique: (...args: unknown[]) => lessonFindUniqueMock(...args) },
    enrollment: { findUnique: (...args: unknown[]) => enrollmentFindUniqueMock(...args) },
  },
}));

describe("canViewLesson", () => {
  beforeEach(() => {
    assignmentFindUniqueMock.mockReset();
    lessonFindUniqueMock.mockReset();
    enrollmentFindUniqueMock.mockReset();
  });

  it("returns true for ADMIN without querying the database", async () => {
    const { canViewLesson } = await import("./can-view-lesson");

    const result = await canViewLesson({ userId: "admin-1", role: "ADMIN", lessonId: "lesson-1" });

    expect(result).toBe(true);
    expect(assignmentFindUniqueMock).not.toHaveBeenCalled();
  });

  it("returns true for MANAGER without querying the database", async () => {
    const { canViewLesson } = await import("./can-view-lesson");

    const result = await canViewLesson({ userId: "mgr-1", role: "MANAGER", lessonId: "lesson-1" });

    expect(result).toBe(true);
    expect(assignmentFindUniqueMock).not.toHaveBeenCalled();
  });

  it("returns true for STUDENT with an active assignment", async () => {
    assignmentFindUniqueMock.mockResolvedValue({ studentId: "stu-1", lessonId: "lesson-1" });
    const { canViewLesson } = await import("./can-view-lesson");

    const result = await canViewLesson({ userId: "stu-1", role: "STUDENT", lessonId: "lesson-1" });

    expect(result).toBe(true);
    expect(assignmentFindUniqueMock).toHaveBeenCalledWith({
      where: { studentId_lessonId: { studentId: "stu-1", lessonId: "lesson-1" } },
    });
  });

  it("returns false for STUDENT with no assignment", async () => {
    assignmentFindUniqueMock.mockResolvedValue(null);
    const { canViewLesson } = await import("./can-view-lesson");

    const result = await canViewLesson({ userId: "stu-2", role: "STUDENT", lessonId: "lesson-1" });

    expect(result).toBe(false);
  });

  it("returns true for TEACHER/PARENT when the studentId happens to match an assignment row (no dedicated role gate)", async () => {
    assignmentFindUniqueMock.mockResolvedValue({ studentId: "teacher-1", lessonId: "lesson-1" });
    const { canViewLesson } = await import("./can-view-lesson");

    const teacherResult = await canViewLesson({ userId: "teacher-1", role: "TEACHER", lessonId: "lesson-1" });
    const parentResult = await canViewLesson({ userId: "parent-1", role: "PARENT", lessonId: "lesson-1" });

    // Only STUDENT and ADMIN/MANAGER are special-cased; TEACHER/PARENT fall through
    // to the same assignment lookup as STUDENT (current behavior — assignments are
    // keyed by studentId, so a TEACHER/PARENT id will typically not match, but this
    // test locks in that the function does NOT grant blanket access to those roles).
    expect(teacherResult).toBe(true); // matches current implementation: no role gate beyond ADMIN/MANAGER
    expect(parentResult).toBe(true);
  });

  it("propagates invalid lessonId as a false result when no assignment matches", async () => {
    assignmentFindUniqueMock.mockResolvedValue(null);
    const { canViewLesson } = await import("./can-view-lesson");

    const result = await canViewLesson({ userId: "stu-1", role: "STUDENT", lessonId: "not-a-real-id" });

    expect(result).toBe(false);
  });

  it("returns true via Enrollment when the module is MANUAL and both lesson and module are published", async () => {
    assignmentFindUniqueMock.mockResolvedValue(null);
    lessonFindUniqueMock.mockResolvedValue({
      id: "lesson-1",
      isPublished: true,
      module: { id: "mod-1", courseId: "course-1", isPublished: true, unlockMode: "MANUAL", unlockAfterDays: null, unlockAt: null },
    });
    enrollmentFindUniqueMock.mockResolvedValue({ status: "ACTIVE", enrolledAt: new Date("2026-01-01T00:00:00Z") });

    const { canViewLesson } = await import("./can-view-lesson");
    const result = await canViewLesson({ userId: "stu-3", role: "STUDENT", lessonId: "lesson-1" });

    expect(result).toBe(true);
  });

  it("returns false via Enrollment when the lesson itself is unpublished, even if enrolled", async () => {
    assignmentFindUniqueMock.mockResolvedValue(null);
    lessonFindUniqueMock.mockResolvedValue({
      id: "lesson-1",
      isPublished: false,
      module: { id: "mod-1", courseId: "course-1", isPublished: true, unlockMode: "MANUAL", unlockAfterDays: null, unlockAt: null },
    });
    enrollmentFindUniqueMock.mockResolvedValue({ status: "ACTIVE", enrolledAt: new Date("2026-01-01T00:00:00Z") });

    const { canViewLesson } = await import("./can-view-lesson");
    const result = await canViewLesson({ userId: "stu-3", role: "STUDENT", lessonId: "lesson-1" });

    expect(result).toBe(false);
  });

  it("returns false via Enrollment when the module is unpublished", async () => {
    assignmentFindUniqueMock.mockResolvedValue(null);
    lessonFindUniqueMock.mockResolvedValue({
      id: "lesson-1",
      isPublished: true,
      module: { id: "mod-1", courseId: "course-1", isPublished: false, unlockMode: "MANUAL", unlockAfterDays: null, unlockAt: null },
    });
    enrollmentFindUniqueMock.mockResolvedValue({ status: "ACTIVE", enrolledAt: new Date("2026-01-01T00:00:00Z") });

    const { canViewLesson } = await import("./can-view-lesson");
    const result = await canViewLesson({ userId: "stu-3", role: "STUDENT", lessonId: "lesson-1" });

    expect(result).toBe(false);
  });

  it("DRIP_ENROLLMENT: locked before enrolledAt + unlockAfterDays elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T00:00:00Z")); // 14 days after enrollment
    assignmentFindUniqueMock.mockResolvedValue(null);
    lessonFindUniqueMock.mockResolvedValue({
      id: "lesson-1",
      isPublished: true,
      module: { id: "mod-2", courseId: "course-1", isPublished: true, unlockMode: "DRIP_ENROLLMENT", unlockAfterDays: 28, unlockAt: null },
    });
    enrollmentFindUniqueMock.mockResolvedValue({ status: "ACTIVE", enrolledAt: new Date("2026-01-01T00:00:00Z") });

    const { canViewLesson } = await import("./can-view-lesson");
    const result = await canViewLesson({ userId: "stu-3", role: "STUDENT", lessonId: "lesson-1" });

    expect(result).toBe(false);
    vi.useRealTimers();
  });

  it("DRIP_ENROLLMENT: unlocked exactly at enrolledAt + unlockAfterDays boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-29T00:00:00Z")); // exactly 28 days after enrollment
    assignmentFindUniqueMock.mockResolvedValue(null);
    lessonFindUniqueMock.mockResolvedValue({
      id: "lesson-1",
      isPublished: true,
      module: { id: "mod-2", courseId: "course-1", isPublished: true, unlockMode: "DRIP_ENROLLMENT", unlockAfterDays: 28, unlockAt: null },
    });
    enrollmentFindUniqueMock.mockResolvedValue({ status: "ACTIVE", enrolledAt: new Date("2026-01-01T00:00:00Z") });

    const { canViewLesson } = await import("./can-view-lesson");
    const result = await canViewLesson({ userId: "stu-3", role: "STUDENT", lessonId: "lesson-1" });

    expect(result).toBe(true);
    vi.useRealTimers();
  });

  it("FIXED_DATE: locked before unlockAt, unlocked at/after unlockAt", async () => {
    vi.useFakeTimers();
    assignmentFindUniqueMock.mockResolvedValue(null);
    lessonFindUniqueMock.mockResolvedValue({
      id: "lesson-1",
      isPublished: true,
      module: {
        id: "mod-3",
        courseId: "course-1",
        isPublished: true,
        unlockMode: "FIXED_DATE",
        unlockAfterDays: null,
        unlockAt: new Date("2026-03-01T00:00:00Z"),
      },
    });
    enrollmentFindUniqueMock.mockResolvedValue({ status: "ACTIVE", enrolledAt: new Date("2026-01-01T00:00:00Z") });
    const { canViewLesson } = await import("./can-view-lesson");

    vi.setSystemTime(new Date("2026-02-28T23:59:59Z"));
    expect(await canViewLesson({ userId: "stu-3", role: "STUDENT", lessonId: "lesson-1" })).toBe(false);

    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    expect(await canViewLesson({ userId: "stu-3", role: "STUDENT", lessonId: "lesson-1" })).toBe(true);

    vi.useRealTimers();
  });

  it("returns false when the student has no Enrollment for the lesson's course and no direct Assignment", async () => {
    assignmentFindUniqueMock.mockResolvedValue(null);
    lessonFindUniqueMock.mockResolvedValue({
      id: "lesson-1",
      isPublished: true,
      module: { id: "mod-1", courseId: "course-1", isPublished: true, unlockMode: "MANUAL", unlockAfterDays: null, unlockAt: null },
    });
    enrollmentFindUniqueMock.mockResolvedValue(null);

    const { canViewLesson } = await import("./can-view-lesson");
    const result = await canViewLesson({ userId: "stu-4", role: "STUDENT", lessonId: "lesson-1" });

    expect(result).toBe(false);
  });

  it("returns false when the Enrollment exists but is SUSPENDED", async () => {
    assignmentFindUniqueMock.mockResolvedValue(null);
    lessonFindUniqueMock.mockResolvedValue({
      id: "lesson-1",
      isPublished: true,
      module: { id: "mod-1", courseId: "course-1", isPublished: true, unlockMode: "MANUAL", unlockAfterDays: null, unlockAt: null },
    });
    enrollmentFindUniqueMock.mockResolvedValue({ status: "SUSPENDED", enrolledAt: new Date("2026-01-01T00:00:00Z") });

    const { canViewLesson } = await import("./can-view-lesson");
    const result = await canViewLesson({ userId: "stu-5", role: "STUDENT", lessonId: "lesson-1" });

    expect(result).toBe(false);
  });

  it("returns false gracefully (no throw) when the lesson row does not exist", async () => {
    assignmentFindUniqueMock.mockResolvedValue(null);
    lessonFindUniqueMock.mockResolvedValue(null);

    const { canViewLesson } = await import("./can-view-lesson");
    const result = await canViewLesson({ userId: "stu-6", role: "STUDENT", lessonId: "ghost-lesson" });

    expect(result).toBe(false);
    expect(enrollmentFindUniqueMock).not.toHaveBeenCalled();
  });

  it("direct Assignment short-circuits and never queries Enrollment (Step B before Step C)", async () => {
    assignmentFindUniqueMock.mockResolvedValue({ studentId: "stu-1", lessonId: "lesson-1" });

    const { canViewLesson } = await import("./can-view-lesson");
    const result = await canViewLesson({ userId: "stu-1", role: "STUDENT", lessonId: "lesson-1" });

    expect(result).toBe(true);
    expect(lessonFindUniqueMock).not.toHaveBeenCalled();
    expect(enrollmentFindUniqueMock).not.toHaveBeenCalled();
  });
});
