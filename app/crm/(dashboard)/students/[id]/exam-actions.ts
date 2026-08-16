"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/shared/lib/db";
import { getSessionUser } from "@/shared/lib/auth";
import { examGoalSchema, examResultSchema } from "@/crm/lib/schemas";
import type { ActionResult } from "@/crm/lib/types";

async function requireTeachingStaff() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { error: "Требуется авторизация" } as const;
  }

  if (!["ADMIN", "TEACHER"].includes(sessionUser.role)) {
    return { error: "У вас нет прав для редактирования целей по экзаменам" } as const;
  }

  return { user: sessionUser } as const;
}

export async function saveStudentExamGoal(
  studentId: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = examGoalSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const auth = await requireTeachingStaff();
  if ("error" in auth) return auth;

  try {
    await db.studentExamGoal.upsert({
      where: {
        studentId_subject: { studentId, subject: parsed.data.subject },
      },
      update: {
        startScore: parsed.data.startScore,
        targetScore: parsed.data.targetScore,
      },
      create: {
        studentId,
        subject: parsed.data.subject,
        startScore: parsed.data.startScore,
        targetScore: parsed.data.targetScore,
      },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка сохранения цели",
    };
  }

  revalidatePath(`/students/${studentId}`);
  return {};
}

export async function addExamResult(
  studentId: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = examResultSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const auth = await requireTeachingStaff();
  if ("error" in auth) return auth;

  try {
    await db.studentExamResult.create({
      data: {
        studentId,
        subject: parsed.data.subject,
        testName: parsed.data.testName,
        currentScore: parsed.data.currentScore,
        maxScore: parsed.data.maxScore,
        testedAt: parsed.data.testedAt,
      },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка добавления результата",
    };
  }

  revalidatePath(`/students/${studentId}`);
  return {};
}

export async function deleteExamResult(
  resultId: string,
  studentId: string,
): Promise<ActionResult> {
  const auth = await requireTeachingStaff();
  if ("error" in auth) return auth;

  try {
    await db.studentExamResult.delete({ where: { id: resultId } });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка удаления результата",
    };
  }

  revalidatePath(`/students/${studentId}`);
  return {};
}
