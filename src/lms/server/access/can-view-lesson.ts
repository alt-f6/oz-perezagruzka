import { db } from "@/shared/lib/db";
import type { Role } from "@/shared/lib/auth";

export async function canViewLesson(params: { userId: string; role: Role; lessonId: string }) {
  const { userId, role, lessonId } = params;

  if (role === "ADMIN" || role === "MANAGER") return true;

  const assignment = await db.assignment.findUnique({
    where: { studentId_lessonId: { studentId: userId, lessonId } },
  });

  return Boolean(assignment);
}
