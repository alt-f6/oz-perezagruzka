import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  groupStudent: { findFirst: vi.fn() },
}));
const notFoundMock = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

const { isStudentOwnedByTeacher, assertStudentVisibleToTeacher } = await import("./access");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isStudentOwnedByTeacher", () => {
  it("returns true when the student is enrolled in one of the teacher's groups", async () => {
    dbMock.groupStudent.findFirst.mockResolvedValue({ studentId: "student_1" });

    const result = await isStudentOwnedByTeacher("teacher_1", "student_1");

    expect(result).toBe(true);
    expect(dbMock.groupStudent.findFirst).toHaveBeenCalledWith({
      where: { studentId: "student_1", group: { teacherId: "teacher_1" } },
      select: { studentId: true },
    });
  });

  it("returns false when no link exists", async () => {
    dbMock.groupStudent.findFirst.mockResolvedValue(null);

    const result = await isStudentOwnedByTeacher("teacher_1", "student_2");

    expect(result).toBe(false);
  });
});

describe("assertStudentVisibleToTeacher", () => {
  it("does nothing for non-TEACHER roles, without querying ownership", async () => {
    await assertStudentVisibleToTeacher(
      { id: "admin_1", email: null, role: "ADMIN" },
      "student_1",
    );

    expect(dbMock.groupStudent.findFirst).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("passes through silently when a TEACHER owns the student", async () => {
    dbMock.groupStudent.findFirst.mockResolvedValue({ studentId: "student_1" });

    await assertStudentVisibleToTeacher(
      { id: "teacher_1", email: null, role: "TEACHER" },
      "student_1",
    );

    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("triggers a hard 404 when a TEACHER doesn't own the student", async () => {
    dbMock.groupStudent.findFirst.mockResolvedValue(null);

    await expect(
      assertStudentVisibleToTeacher(
        { id: "teacher_1", email: null, role: "TEACHER" },
        "someone_elses_student",
      ),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalled();
  });
});
