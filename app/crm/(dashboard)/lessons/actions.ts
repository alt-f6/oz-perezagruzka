"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@prisma/client";
import { lessonSchema, makeupSchema, type LessonValues } from "@/crm/lib/schemas";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { BillingService } from "@/crm/lib/services/billing.service";
import { formatMoscowDate, formatMoscowTime } from "@/shared/lib/timezone";
import type { ActionResult } from "@/crm/lib/types";
import {
  expandOccurrences,
  type Occurrence,
} from "@/crm/lib/lessonOccurrences";
import { collectUnavailableOccurrences } from "@/crm/lib/services/availability.service";

/**
 * A lesson-creation request that lands (partly) outside the teacher's declared
 * working hours. createLesson returns this instead of persisting when the
 * operator hasn't yet acknowledged it, so an ADMIN/MANAGER can override — but
 * never silently.
 */
export interface LessonAvailabilityWarning {
  teacherId: string;
  occurrences: { scheduledAt: string; label: string }[];
}

export type CreateLessonResult =
  | { error: string }
  | { error?: undefined; availabilityWarning?: LessonAvailabilityWarning };

// Longest bookable lesson (see lessonDurationOptions). Used only to widen the
// DB scan window so an existing lesson that starts before the earliest new
// occurrence can still be considered for overlap.
const MAX_LESSON_DURATION_MS = 120 * 60_000;

function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Returns the first existing scheduled ClassSession for `teacherId` that
 * overlaps any of the requested occurrences, or null when the teacher is free.
 * Scans only still-"scheduled" sessions in the occurrences' time window; the
 * window is padded by the max lesson length so an existing session starting
 * just before the first occurrence is still caught.
 */
async function findTeacherScheduleConflict(
  teacherId: string,
  occurrences: Occurrence[],
): Promise<{ scheduledAt: Date } | null> {
  const starts = occurrences.map((o) => o.scheduledAt.getTime());
  const ends = occurrences.map(
    (o) => o.scheduledAt.getTime() + o.durationMinutes * 60_000,
  );
  const windowStart = new Date(Math.min(...starts) - MAX_LESSON_DURATION_MS);
  const windowEnd = new Date(Math.max(...ends));

  const existing = await db.classSession.findMany({
    where: {
      teacherId,
      status: "scheduled",
      scheduledAt: { gte: windowStart, lt: windowEnd },
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  for (const occ of occurrences) {
    const occStart = occ.scheduledAt.getTime();
    const occEnd = occStart + occ.durationMinutes * 60_000;
    for (const s of existing) {
      const sStart = new Date(s.scheduledAt).getTime();
      const sEnd = sStart + s.durationMinutes * 60_000;
      if (intervalsOverlap(occStart, occEnd, sStart, sEnd)) {
        return { scheduledAt: occ.scheduledAt };
      }
    }
  }

  return null;
}

export async function createLesson(
  values: LessonValues,
): Promise<CreateLessonResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  const parsed = lessonSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Некорректные данные занятия" };
  }

  // Resolve the effective teacher plus the group/student wiring the session
  // rows will carry, branching on the chosen lesson format. GROUP sessions
  // derive their teacher from the group; INDIVIDUAL sessions are wired to a
  // single student + directly-assigned teacher, with no dummy group.
  let teacherId: string;
  let sessionLink: {
    type: "GROUP" | "INDIVIDUAL";
    groupId: string | null;
    studentId: string | null;
    pricePerLesson: number | null;
  };

  if (parsed.data.type === "INDIVIDUAL") {
    const studentId = parsed.data.studentId as string;
    const chosenTeacherId = parsed.data.teacherId as string;

    const [student, teacher] = await Promise.all([
      db.student.findFirst({
        where: { id: studentId, deletedAt: null },
        select: { id: true },
      }),
      db.user.findFirst({
        where: { id: chosenTeacherId, role: "TEACHER" },
        select: { id: true },
      }),
    ]);
    if (!student) {
      return { error: "Ученик не найден" };
    }
    if (!teacher) {
      return { error: "Преподаватель не найден" };
    }

    teacherId = chosenTeacherId;
    sessionLink = {
      type: "INDIVIDUAL",
      groupId: null,
      studentId,
      pricePerLesson: parsed.data.pricePerLesson
        ? Number(parsed.data.pricePerLesson)
        : null,
    };
  } else {
    const group = await db.group.findUnique({
      where: { id: parsed.data.groupId as string },
      select: { teacherId: true },
    });
    if (!group) {
      return { error: "Группа не найдена" };
    }
    if (!group.teacherId) {
      return { error: "Сначала назначьте преподавателя группе" };
    }
    teacherId = group.teacherId;
    sessionLink = {
      type: "GROUP",
      groupId: parsed.data.groupId as string,
      studentId: null,
      pricePerLesson: null,
    };
  }

  const occurrences = expandOccurrences(parsed.data);
  if (occurrences.length === 0) {
    return { error: "Не удалось рассчитать даты занятий" };
  }

  // TIME-03: reject (never silently shift) a new lesson that overlaps an
  // existing scheduled lesson for the same teacher. Overlap is checked on the
  // exact [start, end) instant intervals so back-to-back lessons are allowed
  // but any true overlap is blocked with a clear conflict message.
  const conflict = await findTeacherScheduleConflict(teacherId, occurrences);
  if (conflict) {
    return {
      error: `Преподаватель уже занят ${formatMoscowDate(conflict.scheduledAt)} в ${formatMoscowTime(
        conflict.scheduledAt,
      )}. Выберите другое время.`,
    };
  }

  // Availability guard (soft): surface any occurrence that falls in an hour the
  // teacher has NOT marked as working. ADMIN/MANAGER may override by re-submitting
  // with acknowledgeUnavailable, but the create never proceeds silently.
  if (!parsed.data.acknowledgeUnavailable) {
    const unavailable = await collectUnavailableOccurrences(
      teacherId,
      occurrences,
    );
    if (unavailable.length > 0) {
      return {
        availabilityWarning: {
          teacherId,
          occurrences: unavailable.map((o) => ({
            scheduledAt: o.scheduledAt.toISOString(),
            label: `${formatMoscowDate(o.scheduledAt)} в ${formatMoscowTime(o.scheduledAt)}`,
          })),
        },
      };
    }
  }

  const recurrenceGroupId =
    parsed.data.recurrence === "NONE" ? null : crypto.randomUUID();

  try {
    await db.classSession.createMany({
      data: occurrences.map(({ scheduledAt, durationMinutes }) => ({
        type: sessionLink.type,
        groupId: sessionLink.groupId,
        studentId: sessionLink.studentId,
        pricePerLesson: sessionLink.pricePerLesson,
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
