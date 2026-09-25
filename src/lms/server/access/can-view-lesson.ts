import { db } from "@/shared/lib/db";
import type { Role } from "@/shared/lib/auth";
import { computeModuleUnlockStatus, isWithinPaidAccess } from "./module-unlock";
import { getModulePosition } from "./module-position";
import { getTeacherAccessibleCourseIds } from "@/lms/server/teacher-access";

// Staff roles that preview a lesson regardless of its own or its module's
// isPublished state, and regardless of enrollment/assignment. ADMIN/MANAGER
// see every lesson; TEACHER only lessons of their accessible courses
// (src/lms/server/teacher-access.ts), drafts included.
export const STAFF_PREVIEW_ROLES: readonly Role[] = ["ADMIN", "MANAGER", "TEACHER"];

export function isStaffPreviewRole(role: Role): boolean {
  return STAFF_PREVIEW_ROLES.includes(role);
}

export async function canViewLesson(params: { userId: string; role: Role; lessonId: string }) {
  const { userId, role, lessonId } = params;

  // Step A: staff preview bypass.
  if (role === "ADMIN" || role === "MANAGER") return true;
  if (role === "TEACHER") {
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: { module: { select: { courseId: true } } },
    });
    if (!lesson?.module) return false;
    return (await getTeacherAccessibleCourseIds(userId)).includes(lesson.module.courseId);
  }

  // Step B: direct per-student override, independent of enrollment/module state.
  const assignment = await db.assignment.findUnique({
    where: { studentId_lessonId: { studentId: userId, lessonId } },
  });
  if (assignment) return true;

  // Step C: course enrollment + module unlock rules.
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      isPublished: true,
      module: {
        select: {
          id: true,
          order: true,
          courseId: true,
          isPublished: true,
          unlockMode: true,
          unlockAfterDays: true,
          unlockAt: true,
        },
      },
    },
  });
  if (!lesson || !lesson.module) return false;
  if (!lesson.isPublished || !lesson.module.isPublished) return false;

  const enrollment = await db.enrollment.findUnique({
    where: { studentId_courseId: { studentId: userId, courseId: lesson.module.courseId } },
  });
  if (!enrollment || enrollment.status !== "ACTIVE") return false;

  if (!computeModuleUnlockStatus(lesson.module, enrollment.enrolledAt).unlocked) return false;

  // Step D: monthly abonement -- only the first N paid modules are open.
  // Skip the position lookup entirely for whole-course enrollments.
  if (enrollment.accessThroughModule === null || enrollment.accessThroughModule === undefined) return true;
  const position = await getModulePosition(lesson.module);
  return isWithinPaidAccess(position, enrollment.accessThroughModule);
}
