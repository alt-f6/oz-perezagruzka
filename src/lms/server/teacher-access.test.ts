import { describe, it, expect, vi, beforeEach } from "vitest";

const groupFindManyMock = vi.fn();
const courseFindManyMock = vi.fn();

vi.mock("@/shared/lib/db", () => ({
  db: {
    group: { findMany: (...args: unknown[]) => groupFindManyMock(...args) },
    course: { findMany: (...args: unknown[]) => courseFindManyMock(...args) },
  },
}));

const { teacherCourseWhere, getTeacherAccessibleCourseIds, canTeacherAccessCourse } = await import("./teacher-access");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("teacherCourseWhere", () => {
  it("covers owner and explicit links even with no CRM groups", () => {
    expect(teacherCourseWhere("t1", [])).toEqual({
      OR: [{ teacherId: "t1" }, { teachers: { some: { teacherId: "t1" } } }],
    });
  });

  it("matches a group subject whole, falling back to the title only for subject-less courses", () => {
    const where = teacherCourseWhere("t1", ["Математика"]);

    expect(where.OR).toContainEqual({ subject: { equals: "Математика", mode: "insensitive" } });
    expect(where.OR).toContainEqual({ subject: null, title: { contains: "Математика", mode: "insensitive" } });
  });
});

describe("getTeacherAccessibleCourseIds", () => {
  it("queries live groups' distinct subjects, then courses in one query", async () => {
    groupFindManyMock.mockResolvedValue([{ subject: "Математика " }, { subject: "Физика" }]);
    courseFindManyMock.mockResolvedValue([{ id: "c-oge" }, { id: "c-ege" }]);

    const ids = await getTeacherAccessibleCourseIds("t-fofanov");

    expect(ids).toEqual(["c-oge", "c-ege"]);
    expect(groupFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teacherId: "t-fofanov", deletedAt: null, subject: { not: null } } }),
    );
    expect(courseFindManyMock).toHaveBeenCalledTimes(1);
    expect(courseFindManyMock.mock.calls[0][0].where).toEqual(teacherCourseWhere("t-fofanov", ["Математика", "Физика"]));
  });
});

describe("canTeacherAccessCourse", () => {
  it("lets ADMIN/MANAGER through without a lookup", async () => {
    expect(await canTeacherAccessCourse({ id: "a", role: "ADMIN" }, "c1")).toBe(true);
    expect(await canTeacherAccessCourse({ id: "m", role: "MANAGER" }, "c1")).toBe(true);
    expect(groupFindManyMock).not.toHaveBeenCalled();
  });

  it("denies STUDENT outright", async () => {
    expect(await canTeacherAccessCourse({ id: "s", role: "STUDENT" }, "c1")).toBe(false);
  });

  it("scopes TEACHER to the accessible set", async () => {
    groupFindManyMock.mockResolvedValue([]);
    courseFindManyMock.mockResolvedValue([{ id: "c1" }]);

    expect(await canTeacherAccessCourse({ id: "t2", role: "TEACHER" }, "c1")).toBe(true);
    expect(await canTeacherAccessCourse({ id: "t3", role: "TEACHER" }, "c2")).toBe(false);
  });
});
