import { db } from "@/shared/lib/db";
import type { Role } from "@/shared/lib/auth";
import { computeModuleUnlockStatus } from "./module-unlock";

export async function canViewLesson(params: { userId: string; role: Role; lessonId: string }) {
  const { userId, role, lessonId } = params;

  // Step A: admin/manager bypass.
  if (role === "ADMIN" || role === "MANAGER") return true;

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
