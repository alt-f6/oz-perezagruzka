import { cache } from "react";
import type { Prisma } from "@prisma/client";

import { db } from "@/shared/lib/db";
import type { SessionUser } from "@/shared/lib/auth";

// Which LMS courses a TEACHER may see. A course is accessible when any of:
//   1. the teacher owns it (Course.teacherId -- legacy single-owner scoping),
//   2. an admin/manager linked them explicitly (CourseTeacher, /admin/courses),
//   3. the teacher runs a live CRM group in the course's subject.
// (3) is subject-wide on purpose: a teacher of an OGE maths group also gets
// the EGE maths course. Group.subject and Course.subject share one vocabulary
// (src/shared/lib/education.ts), so they're compared whole, not by stem; a
// legacy course with no subject set falls back to its title containing it.

/** Pure: the Course filter for a teacher, given their CRM group subjects. */
export function teacherCourseWhere(teacherId: string, subjects: string[]): Prisma.CourseWhereInput {
  const bySubject: Prisma.CourseWhereInput[] = subjects.flatMap((subject) => [
    { subject: { equals: subject, mode: "insensitive" } },
    { subject: null, title: { contains: subject, mode: "insensitive" } },
  ]);
  return { OR: [{ teacherId }, { teachers: { some: { teacherId } } }, ...bySubject] };
}

async function getTeacherGroupSubjects(teacherId: string): Promise<string[]> {
  const groups = await db.group.findMany({
    where: { teacherId, deletedAt: null, subject: { not: null } },
    select: { subject: true },
    distinct: ["subject"],
  });
  return [...new Set(groups.map((g) => g.subject?.trim()).filter((s): s is string => Boolean(s)))];
}

/**
 * Course ids a teacher may open. Memoized per request (React cache), so a
 * page and the access checks it runs share one lookup.
 */
export const getTeacherAccessibleCourseIds = cache(async (teacherId: string): Promise<string[]> => {
  const subjects = await getTeacherGroupSubjects(teacherId);
  const courses = await db.course.findMany({
    where: teacherCourseWhere(teacherId, subjects),
    select: { id: true },
  });
  return courses.map((c) => c.id);
});

/** ADMIN/MANAGER see every course; TEACHER only their accessible set. */
export async function canTeacherAccessCourse(
  user: Pick<SessionUser, "id" | "role">,
  courseId: string,
): Promise<boolean> {
  if (user.role === "ADMIN" || user.role === "MANAGER") return true;
  if (user.role !== "TEACHER") return false;
  return (await getTeacherAccessibleCourseIds(user.id)).includes(courseId);
}
