"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { submitHomeworkSchema } from "@/crm/lib/schemas";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import type { ActionResult } from "@/crm/lib/types";

const SUBMISSION_FILE_MAX_SIZE_BYTES = 25 * 1024 * 1024;

function safeSubmissionFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
}

async function resolveStudentProfile(userId: string) {
  return db.student.findFirst({ where: { userId }, select: { id: true } });
}

// A student may only submit homework for a ClassSession they're actually
// part of: an INDIVIDUAL lesson booked directly for them, or a GROUP lesson
// whose roster they're on. Mirrors the ownership check used for teachers in
// app/crm/(dashboard)/lessons/actions.ts, just from the student's side.
async function loadOwnedLesson(lessonId: string, studentId: string) {
  const lesson = await db.classSession.findUnique({
    where: { id: lessonId },
    select: { id: true, studentId: true, groupId: true },
  });
  if (!lesson) return null;
  if (lesson.studentId === studentId) return lesson;
  if (lesson.groupId) {
    const membership = await db.groupStudent.findUnique({
      where: { groupId_studentId: { groupId: lesson.groupId, studentId } },
      select: { studentId: true },
    });
    if (membership) return lesson;
  }
  return null;
}

export async function getSubmissionUploadUrl(
  lessonId: string,
  file: { name: string; mimeType: string; sizeBytes: number },
): Promise<
  | { error: string }
  | { error?: undefined; uploadUrl: string; fileKey: string; fileName: string }
> {
  const sessionUser = await requireRole(["STUDENT"]);
  const student = await resolveStudentProfile(sessionUser.id);
  if (!student) return { error: "Профиль ученика не найден" };

  const lesson = await loadOwnedLesson(lessonId, student.id);
  if (!lesson) return { error: "Урок не найден" };

  if (!Number.isFinite(file.sizeBytes) || file.sizeBytes <= 0) {
    return { error: "Некорректный размер файла" };
  }
  if (file.sizeBytes > SUBMISSION_FILE_MAX_SIZE_BYTES) {
    return { error: "Файл слишком большой (максимум 25 МБ)" };
  }

  const fileName = safeSubmissionFileName(file.name);
  const fileKey = `homework-submissions/${lessonId}/${student.id}/${randomUUID()}-${fileName}`;

  try {
    // Lazy-imported: the R2 client throws at module load if its env vars are
    // unset, and eagerly importing it here would break every test/page that
    // merely imports this actions.ts file for its other, unrelated exports.
    const { signPutObject } = await import("@/lms/server/r2/signed");
    const uploadUrl = await signPutObject(fileKey, file.mimeType);
    return { uploadUrl, fileKey, fileName };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось подготовить загрузку файла",
    };
  }
}

export async function submitHomework(values: {
  lessonId: string;
  content?: string;
  fileKey?: string;
}): Promise<ActionResult> {
  const sessionUser = await requireRole(["STUDENT"]);

  const parsed = submitHomeworkSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const student = await resolveStudentProfile(sessionUser.id);
  if (!student) return { error: "Профиль ученика не найден" };

  const lesson = await loadOwnedLesson(parsed.data.lessonId, student.id);
  if (!lesson) return { error: "Урок не найден" };

  // IDOR guard: the only legitimate source of fileKey is getSubmissionUploadUrl,
  // which always mints keys scoped to `homework-submissions/{lessonId}/{studentId}/...`.
  // Reject anything else rather than trusting a client-supplied key that could
  // point at another lesson's or student's file.
  if (
    parsed.data.fileKey !== undefined &&
    !parsed.data.fileKey.startsWith(
      `homework-submissions/${parsed.data.lessonId}/${student.id}/`,
    )
  ) {
    return { error: "Некорректный ключ файла" };
  }

  const existing = await db.submission.findUnique({
    where: {
      lessonId_studentId: { lessonId: parsed.data.lessonId, studentId: student.id },
    },
    select: { status: true },
  });
  if (existing && existing.status !== "SUBMITTED" && existing.status !== "NEEDS_REVISION") {
    return { error: "Работа уже проверена, отправка новой версии недоступна" };
  }

  // Full-replace semantics, not a merge: the client sends the complete current
  // form state on every submit, so an omitted field really means "cleared",
  // not "leave whatever was there before" -- matching the upsert the spec asks for.
  const data = {
    content: parsed.data.content ?? null,
    fileKey: parsed.data.fileKey ?? null,
    status: "SUBMITTED" as const,
  };

  await db.submission.upsert({
    where: {
      lessonId_studentId: { lessonId: parsed.data.lessonId, studentId: student.id },
    },
    update: data,
    create: { lessonId: parsed.data.lessonId, studentId: student.id, ...data },
  });

  revalidatePath("/portal/dashboard");
  return {};
}
