import { notFound } from "next/navigation";
import { db } from "@/shared/lib/db";
import type { SessionUser } from "@/shared/lib/auth";

/**
 * A teacher "owns" a student only through a group they're assigned to teach
 * (Student <-GroupStudent-> Group.teacherId). This is the single check every
 * teacher-facing student access path (page loads, actions) must go through.
 */
export async function isStudentOwnedByTeacher(
  teacherId: string,
  studentId: string,
): Promise<boolean> {
  const link = await db.groupStudent.findFirst({
    where: { studentId, group: { teacherId } },
    select: { studentId: true },
  });
  return Boolean(link);
}

/**
 * Server Component guard for student detail/profile pages. Teachers who
 * navigate directly to a student outside their roster get a hard 404 —
 * not a "not yours" message — so the response can't be used to distinguish
 * a nonexistent student from one that just isn't theirs.
 */
export async function assertStudentVisibleToTeacher(
  sessionUser: SessionUser,
  studentId: string,
): Promise<void> {
  if (sessionUser.role !== "TEACHER") return;
  const owned = await isStudentOwnedByTeacher(sessionUser.id, studentId);
  if (!owned) notFound();
}
