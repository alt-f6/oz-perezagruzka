import type { Prisma } from "@prisma/client";

import { db } from "@/shared/lib/db";
import type { SessionUser } from "@/shared/lib/auth";
import { DEFAULT_COURSE_TITLE } from "@/lms/server/repos/default-module";
import { canTeacherAccessCourse, getTeacherAccessibleCourseIds } from "@/lms/server/teacher-access";

// Read models for the teacher workspace (/teacher/*). Read-only: no mutation
// lives behind any of these. ADMIN (via the layout's adminBypass) sees every
// course, a TEACHER only their accessible set.

type Viewer = Pick<SessionUser, "id" | "role">;

async function viewerCourseWhere(viewer: Viewer): Promise<Prisma.CourseWhereInput> {
  // The "Общий курс" bucket holds unsorted lessons, not a curriculum.
  const base: Prisma.CourseWhereInput = { title: { not: DEFAULT_COURSE_TITLE } };
  if (viewer.role === "ADMIN" || viewer.role === "MANAGER") return base;
  return { ...base, id: { in: await getTeacherAccessibleCourseIds(viewer.id) } };
}

export type TeacherCourseCard = {
  id: string;
  title: string;
  subject: string | null;
  examType: string | null;
  grade: number | null;
  moduleCount: number;
  lessonCount: number;
};

export async function getTeacherCourses(viewer: Viewer): Promise<TeacherCourseCard[]> {
  const courses = await db.course.findMany({
    where: await viewerCourseWhere(viewer),
    orderBy: [{ title: "asc" }],
    select: {
      id: true,
      title: true,
      subject: true,
      examType: true,
      grade: true,
      modules: { select: { _count: { select: { lessons: true } } } },
    },
  });

  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    subject: c.subject,
    examType: c.examType,
    grade: c.grade,
    moduleCount: c.modules.length,
    lessonCount: c.modules.reduce((n, m) => n + m._count.lessons, 0),
  }));
}

export type TeacherCourseOutline = {
  id: string;
  title: string;
  subject: string | null;
  examType: string | null;
  grade: number | null;
  modules: {
    id: string;
    title: string;
    isPublished: boolean;
    lessons: { id: string; title: string; order: number; isPublished: boolean }[];
  }[];
};

/** null when the course doesn't exist or is outside the viewer's scope. */
export async function getTeacherCourseOutline(viewer: Viewer, courseId: string): Promise<TeacherCourseOutline | null> {
  if (!(await canTeacherAccessCourse(viewer, courseId))) return null;

  return db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      subject: true,
      examType: true,
      grade: true,
      modules: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          isPublished: true,
          lessons: {
            orderBy: [{ order: "asc" }, { id: "asc" }],
            select: { id: true, title: true, order: true, isPublished: true },
          },
        },
      },
    },
  });
}
