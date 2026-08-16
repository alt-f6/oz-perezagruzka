"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/shared/lib/db";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { canViewLesson } from "@/lms/server/access/can-view-lesson";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireLessonAccess(lessonId: string) {
  const user = await requireAuth();

  if (user.role !== "STUDENT") {
    throw new Error("forbidden");
  }

  const allowed = await canViewLesson({ userId: user.id, role: user.role, lessonId });

  if (!allowed) {
    throw new Error("forbidden");
  }

  return user;
}

export async function setLessonCompletion(
  lessonId: string,
  completed: boolean
): Promise<ActionResult> {
  if (!lessonId) {
    return { ok: false, error: "bad_lesson_id" };
  }

  let user;
  try {
    user = await requireLessonAccess(lessonId);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  const completedAt = completed ? new Date() : null;

  await db.lessonProgress.upsert({
    where: { studentId_lessonId: { studentId: user.id, lessonId } },
    create: { studentId: user.id, lessonId, completedAt },
    update: { completedAt },
  });

  revalidatePath(`/student/lessons/${lessonId}`);

  return { ok: true };
}

export async function syncPlaybackPosition(
  lessonId: string,
  positionSeconds: number
): Promise<ActionResult> {
  if (!lessonId) {
    return { ok: false, error: "bad_lesson_id" };
  }

  const position = Math.max(0, Math.floor(positionSeconds));

  let user;
  try {
    user = await requireLessonAccess(lessonId);
  } catch {
    return { ok: false, error: "forbidden" };
  }

  await db.lessonProgress.upsert({
    where: { studentId_lessonId: { studentId: user.id, lessonId } },
    create: { studentId: user.id, lessonId, lastPositionSeconds: position },
    update: { lastPositionSeconds: position },
  });

  return { ok: true };
}
