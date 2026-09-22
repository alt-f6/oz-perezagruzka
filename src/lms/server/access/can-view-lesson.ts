import { db } from "@/shared/lib/db";
import type { Role } from "@/shared/lib/auth";
import { computeModuleUnlockStatus } from "./module-unlock";

// Staff roles that must be able to preview a lesson regardless of its own or
// its module's isPublished state, and regardless of enrollment/assignment.
// MANAGER already had this bypass before this change; TEACHER is added so
// course teachers can review their own draft material (educator preview).
const STAFF_PREVIEW_ROLES: readonly Role[] = ["ADMIN", "MANAGER", "TEACHER"];

export async function canViewLesson(params: { userId: string; role: Role; lessonId: string }) {
  const { userId, role, lessonId } = params;

  // Step A: staff preview bypass.
  if (STAFF_PREVIEW_ROLES.includes(role)) return true;

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

  return computeModuleUnlockStatus(lesson.module, enrollment.enrolledAt).unlocked;
}
