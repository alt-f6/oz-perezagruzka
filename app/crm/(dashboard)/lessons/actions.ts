"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@prisma/client";
import { lessonSchema, makeupSchema, type LessonValues } from "@/crm/lib/schemas";
import { parseDateKey } from "@/crm/lib/calendarGrid";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { BillingService } from "@/crm/lib/services/billing.service";
import type { ActionResult } from "@/crm/lib/types";

const MAX_RECURRING_SESSIONS = 200;

interface Occurrence {
  scheduledAt: Date;
  durationMinutes: number;
}

/**
 * Resolves the start time + duration for a given weekday: its own per-day slot
 * override when present, otherwise the top-level default.
 */
function resolveSlot(
  values: LessonValues,
  weekday: number,
): { time: string; durationMinutes: number } {
  const slot = values.daySlots?.find((s) => s.day === weekday);
  if (slot) {
    return { time: slot.time, durationMinutes: slot.durationMinutes };
  }
  return { time: values.time, durationMinutes: values.durationMinutes };
}

function atTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Expands a recurring-lesson request into every occurrence, honoring per-day
 * time/duration overrides, capped at MAX_RECURRING_SESSIONS as a backstop
 * (schema already caps the end date to ~3 months out, but a daily WEEKDAYS
 * pattern over that range is still bounded well under this).
 *
 * Dates are parsed with parseDateKey (local calendar fields), never
 * `new Date("YYYY-MM-DD")` which parses as UTC midnight and would shift the day
 * for non-UTC server timezones.
 */
function expandOccurrences(values: LessonValues): Occurrence[] {
  // Local-midnight anchor for the chosen start date.
  const start = parseDateKey(values.date);

  if (values.recurrence === "NONE") {
    return [
      {
        scheduledAt: atTime(start, values.time),
        durationMinutes: values.durationMinutes,
      },
    ];
  }

  const endDate = parseDateKey(values.recurrenceEndDate as string);
  endDate.setHours(23, 59, 59, 999);

  const allowedDays =
    values.recurrence === "WEEKDAYS"
      ? new Set([1, 2, 3, 4, 5])
      : values.recurrence === "WEEKLY"
        ? new Set([start.getDay()])
        : new Set(values.recurrenceDays ?? []);

  const occurrences: Occurrence[] = [];
  const cursor = new Date(start);
  while (cursor <= endDate && occurrences.length < MAX_RECURRING_SESSIONS) {
    if (allowedDays.has(cursor.getDay())) {
      const { time, durationMinutes } = resolveSlot(values, cursor.getDay());
      occurrences.push({
        scheduledAt: atTime(cursor, time),
        durationMinutes,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences;
}

export async function createLesson(
  values: LessonValues,
): Promise<ActionResult> {
  await requireRole(["ADMIN", "MANAGER"]);

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
  if (!group.teacherId) {
    return { error: "Сначала назначьте преподавателя группе" };
  }
  const teacherId = group.teacherId;

  const occurrences = expandOccurrences(parsed.data);
  if (occurrences.length === 0) {
    return { error: "Не удалось рассчитать даты занятий" };
  }

  const recurrenceGroupId =
    parsed.data.recurrence === "NONE" ? null : crypto.randomUUID();

  try {
    await db.classSession.createMany({
      data: occurrences.map(({ scheduledAt, durationMinutes }) => ({
        groupId: parsed.data.groupId,
        teacherId,
        scheduledAt,
        durationMinutes,
        recurrenceGroupId,
      })),
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось создать занятие",
    };
  }

  revalidatePath("/lessons");
  revalidatePath("/schedule");
  return {};
}

export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  const session = await db.classSession.findUnique({
    where: { id: lessonId },
    select: { status: true, scheduledAt: true },
  });
  if (!session) {
    return { error: "Занятие не найдено" };
  }
  if (session.status !== "scheduled" || new Date(session.scheduledAt) <= new Date()) {
    return { error: "Можно отменить только предстоящее запланированное занятие" };
  }

  try {
    await db.classSession.update({
      where: { id: lessonId },
      data: { status: "cancelled" },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось отменить занятие",
    };
  }

  revalidatePath("/lessons");
  revalidatePath("/schedule");
  return {};
}

export type BulkCancelSelector =
  | { sessionIds: string[] }
  | { recurrenceGroupId: string }
  | { groupId: string };

export type BulkCancelResult =
  | { error: string }
  | { error?: undefined; cancelledCount: number; skippedCount: number };

/**
 * Backs every bulk-cancellation entry point (ad-hoc multi-select, whole
 * recurring series, whole group). Never deletes rows -- only flips eligible
 * sessions to status="cancelled" inside a single transaction, scoped to
 * sessions that are still scheduled and in the future so past/attended
 * history (billing, salary) is never touched.
 */
export async function bulkCancelSessions(
  selector: BulkCancelSelector,
): Promise<BulkCancelResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  const where =
    "sessionIds" in selector
      ? { id: { in: selector.sessionIds } }
      : "recurrenceGroupId" in selector
        ? { recurrenceGroupId: selector.recurrenceGroupId }
        : { groupId: selector.groupId };

  try {
    const result = await db.$transaction(async (tx) => {
      const targets = await tx.classSession.findMany({
        where,
        select: { id: true, status: true, scheduledAt: true },
      });

      const now = new Date();
      const eligibleIds = targets
        .filter((t) => t.status === "scheduled" && new Date(t.scheduledAt) > now)
        .map((t) => t.id);

      if (eligibleIds.length > 0) {
        await tx.classSession.updateMany({
          where: { id: { in: eligibleIds } },
          data: { status: "cancelled" },
        });
      }

      return {
        cancelledCount: eligibleIds.length,
        skippedCount: targets.length - eligibleIds.length,
      };
    });

    revalidatePath("/lessons");
    revalidatePath("/schedule");
    revalidatePath("/groups");
    return result;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось отменить занятия",
    };
  }
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
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

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
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

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
