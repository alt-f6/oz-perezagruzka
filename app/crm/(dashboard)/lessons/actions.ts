"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@prisma/client";
import { lessonSchema, makeupSchema, type LessonValues } from "@/crm/lib/schemas";
import { db } from "@/shared/lib/db";
import { requireSessionUser } from "@/shared/lib/auth";
import { BillingService } from "@/crm/lib/services/billing.service";
import type { ActionResult } from "@/crm/lib/types";

export async function createLesson(
  values: LessonValues,
): Promise<ActionResult> {
  await requireSessionUser(["ADMIN", "MANAGER"]);

  const parsed = lessonSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Некорректные данные занятия" };
  }

  const group = await db.group.findUnique({
    where: { id: parsed.data.groupId },
    select: { teacherId: true },
  });
  if (!group) {
    return { error: "Группа не найдена" };
  }

  try {
    await db.classSession.create({
      data: {
        groupId: parsed.data.groupId,
        teacherId: group.teacherId,
        scheduledAt: new Date(parsed.data.date),
      },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось создать занятие",
    };
  }

  revalidatePath("/lessons");
  return {};
}

export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  await requireSessionUser(["ADMIN", "MANAGER"]);

  try {
    await db.classSession.delete({ where: { id: lessonId } });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось удалить занятие",
    };
  }

  revalidatePath("/lessons");
  return {};
}

export async function setAttendance(
  lessonId: string,
  studentId: string,
  update: {
    status?: AttendanceStatus;
    grade?: number | null;
    homeworkCompleted?: boolean;
  },
): Promise<ActionResult> {
  const sessionUser = await requireSessionUser(["ADMIN", "MANAGER", "TEACHER"]);

  if (sessionUser.role === "TEACHER") {
    const lesson = await db.classSession.findUnique({
      where: { id: lessonId },
      select: { teacherId: true },
    });
    if (!lesson || lesson.teacherId !== sessionUser.id) {
      throw new Error("forbidden: занятие не принадлежит преподавателю");
    }
  }

  try {
    if (update.status !== undefined) {
      await BillingService.markAttendanceAndCharge(
        lessonId,
        studentId,
        update.status,
      );
    }

    if (update.grade !== undefined || update.homeworkCompleted !== undefined) {
      const updateData: { grade?: number | null; homeworkCompleted?: boolean } =
        {};
      if (update.grade !== undefined) updateData.grade = update.grade;
      if (update.homeworkCompleted !== undefined) {
        updateData.homeworkCompleted = update.homeworkCompleted;
      }

      await db.attendance.update({
        where: {
          classSessionId_studentId: {
            classSessionId: lessonId,
            studentId,
          },
        },
        data: updateData,
      });
    }
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Не удалось обновить посещаемость",
    };
  }

  revalidatePath(`/lessons/${lessonId}`);
  return {};
}

export async function assignMakeupLesson(values: {
  attendanceId: string;
  targetLessonId: string;
}): Promise<ActionResult> {
  const sessionUser = await requireSessionUser(["ADMIN", "MANAGER", "TEACHER"]);

  const parsed = makeupSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Некорректные данные отработки" };
  }

  const attendance = await db.attendance.findUnique({
    where: { id: parsed.data.attendanceId },
    select: {
      id: true,
      classSessionId: true,
      status: true,
      classSession: { select: { groupId: true, teacherId: true } },
    },
  });
  if (!attendance) {
    return { error: "Запись посещаемости не найдена" };
  }
  if (
    sessionUser.role === "TEACHER" &&
    attendance.classSession?.teacherId !== sessionUser.id
  ) {
    throw new Error("forbidden: занятие не принадлежит преподавателю");
  }
  if (attendance.status !== "EXCUSED") {
    return {
      error: "Отработку можно назначить только для уважительной причины",
    };
  }

  const targetLesson = await db.classSession.findUnique({
    where: { id: parsed.data.targetLessonId },
    select: { id: true, groupId: true, scheduledAt: true },
  });
  if (!targetLesson) {
    return { error: "Занятие для отработки не найдено" };
  }
  if (new Date(targetLesson.scheduledAt) < new Date()) {
    return { error: "Отработка должна быть назначена на будущее занятие" };
  }

  if (targetLesson.groupId === attendance.classSession?.groupId) {
    return { error: "Отработка должна быть назначена в другой группе" };
  }

  try {
    await db.makeupLesson.upsert({
      where: { excusedAbsenceId: parsed.data.attendanceId },
      create: {
        excusedAbsenceId: parsed.data.attendanceId,
        targetClassSessionId: parsed.data.targetLessonId,
      },
      update: {
        targetClassSessionId: parsed.data.targetLessonId,
      },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось назначить отработку",
    };
  }

  revalidatePath(`/lessons/${attendance.classSessionId}`);
  return {};
}
