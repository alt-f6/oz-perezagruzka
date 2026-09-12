"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceStatus, SubmissionStatus } from "@prisma/client";
import {
  lessonSchema,
  makeupSchema,
  setAttendanceUpdateSchema,
  gradeSubmissionSchema,
  type LessonValues,
} from "@/crm/lib/schemas";
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
import { getLastIndividualLessonPrice } from "@/crm/lib/services/abonement.service";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("lessons.actions");

/**
 * A lesson is only "past" once it has actually finished -- attendance,
 * grading, and homework are routine journal work done during or right after
 * the lesson, so locking a TEACHER out at the *start* time would remove
 * their ability to record any of that for the very lesson they're teaching.
 * Every past-lesson guard in this file must use this (never bare
 * scheduledAt) so the boundary is consistently end-of-lesson, not
 * start-of-lesson.
 */
function isLessonConcluded(scheduledAt: Date, durationMinutes: number): boolean {
  return new Date(scheduledAt).getTime() + durationMinutes * 60_000 <= Date.now();
}

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

/**
 * Surfaced when a past-dated occurrence (ADMIN/MANAGER backfilling a missed
 * lesson) falls in a month for which the resolved teacher already has a
 * TeacherPayout on record. Retagging/charging into an already-paid-out period
 * should never happen silently -- the operator must explicitly confirm.
 */
export interface ClosedPayoutWarning {
  teacherId: string;
  occurrences: { scheduledAt: string; label: string }[];
}

/**
 * Surfaced when an INDIVIDUAL lesson is being created for a student with no
 * prior individual-lesson price on record (no Student rate field or subject
 * rate table exists -- "last individual lesson price" IS the personal
 * rate, per getLastIndividualLessonPrice). The operator must explicitly
 * confirm proceeding at 0 ₽ -- price is never silently guessed.
 */
export interface MissingPriceWarning {
  studentId: string;
  studentName: string;
}

export type CreateLessonResult =
  | { error: string }
  | {
      error?: undefined;
      missingPriceWarning?: MissingPriceWarning;
      availabilityWarning?: LessonAvailabilityWarning;
      closedPayoutWarning?: ClosedPayoutWarning;
    };

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
    isTrial: boolean;
  };

  if (parsed.data.type === "INDIVIDUAL") {
    const studentId = parsed.data.studentId as string;
    const chosenTeacherId = parsed.data.teacherId as string;

    const [student, teacher] = await Promise.all([
      db.student.findFirst({
        where: { id: studentId, deletedAt: null },
        select: { id: true, fullName: true },
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

    // Auto-resolve the per-lesson price server-side -- the client never
    // supplies it. No Student rate field or subject-rate table exists, so
    // the student's most recent individual-lesson price IS the resolved
    // rate; a student with no such history requires an explicit operator
    // acknowledgement before the lesson is created at 0 ₽.
    const resolvedPrice = await getLastIndividualLessonPrice(studentId);
    if (resolvedPrice === null && !parsed.data.acknowledgeMissingPrice) {
      return {
        missingPriceWarning: { studentId, studentName: student.fullName },
      };
    }

    teacherId = chosenTeacherId;
    sessionLink = {
      type: "INDIVIDUAL",
      groupId: null,
      studentId,
      pricePerLesson: resolvedPrice ?? 0,
      isTrial: parsed.data.isTrial ?? false,
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
      isTrial: parsed.data.isTrial ?? false,
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

  // Closed-payout guard (soft): a backfilled past occurrence whose month
  // already has a TeacherPayout on record for the resolved teacher would
  // otherwise silently attribute a new charge/salary-relevant session to an
  // already-closed, already-paid period. ADMIN/MANAGER may override by
  // re-submitting with acknowledgeClosedPayout, never silently.
  const now = new Date();
  const pastOccurrences = occurrences.filter((o) => o.scheduledAt <= now);
  if (pastOccurrences.length > 0 && !parsed.data.acknowledgeClosedPayout) {
    const monthRanges = new Map<string, { start: Date; end: Date }>();
    for (const o of pastOccurrences) {
      const y = o.scheduledAt.getUTCFullYear();
      const m = o.scheduledAt.getUTCMonth();
      const key = `${y}-${m}`;
      if (!monthRanges.has(key)) {
        monthRanges.set(key, {
          start: new Date(Date.UTC(y, m, 1)),
          end: new Date(Date.UTC(y, m + 1, 1)),
        });
      }
    }

    const closedMonthKeys = new Set<string>();
    for (const [key, range] of monthRanges) {
      const payout = await db.teacherPayout.findFirst({
        where: { teacherId, periodFrom: { lt: range.end }, periodTo: { gt: range.start } },
        select: { id: true },
      });
      if (payout) closedMonthKeys.add(key);
    }

    if (closedMonthKeys.size > 0) {
      const closedOccurrences = pastOccurrences.filter((o) =>
        closedMonthKeys.has(`${o.scheduledAt.getUTCFullYear()}-${o.scheduledAt.getUTCMonth()}`),
      );
      return {
        closedPayoutWarning: {
          teacherId,
          occurrences: closedOccurrences.map((o) => ({
            scheduledAt: o.scheduledAt.toISOString(),
            label: `${formatMoscowDate(o.scheduledAt)} в ${formatMoscowTime(o.scheduledAt)}`,
          })),
        },
      };
    }
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
        isTrial: sessionLink.isTrial,
        teacherId,
        scheduledAt,
        durationMinutes,
        recurrenceGroupId,
        // Pre-stamped for anything already in the past at creation time, so
        // the lesson-reminders cron can never pick it up and send a
        // same-day/next-day reminder for a lesson that already happened.
        reminderSentAt: scheduledAt <= now ? now : null,
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

  // No scheduledAt/future restriction here on purpose: a lesson that was
  // entered by mistake (duplicate, wrong group, wrong date) is often only
  // noticed after it's already passed, and an operator must still be able to
  // pull it out of the schedule. What DOES stay guarded is attendance: once a
  // session has any Attendance rows, cancelling it would silently orphan
  // billing/salary history (BillingService.markAttendanceAndCharge already
  // ran), so that case is blocked instead of allowed to corrupt those
  // records.
  const session = await db.classSession.findUnique({
    where: { id: lessonId },
    select: { status: true, _count: { select: { attendance: true } } },
  });
  if (!session) {
    return { error: "Занятие не найдено" };
  }
  if (session.status !== "scheduled") {
    return { error: "Занятие уже отменено" };
  }
  if (session._count.attendance > 0) {
    return {
      error:
        "У занятия уже отмечена посещаемость — отмена недоступна, чтобы не исказить начисления",
    };
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
    comment?: string | null;
  },
): Promise<ActionResult> {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  const parsed = setAttendanceUpdateSchema.safeParse(update);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const lesson = await db.classSession.findUnique({
    where: { id: lessonId },
    select: {
      teacherId: true,
      scheduledAt: true,
      durationMinutes: true,
      group: { select: { teacherId: true } },
    },
  });
  if (!lesson) {
    return { error: "Занятие не найдено" };
  }

  // Past-lesson lock: once a lesson has actually concluded (start +
  // duration), only ADMIN may keep editing attendance/grades/homework -- a
  // TEACHER can still edit anything still in progress or in the future.
  if (
    sessionUser.role !== "ADMIN" &&
    isLessonConcluded(lesson.scheduledAt, lesson.durationMinutes)
  ) {
    return { error: "Редактирование прошедших занятий доступно только администратору" };
  }

  if (sessionUser.role === "TEACHER") {
    // Own the lesson either directly, or via the group's *current* teacher --
    // a group reassignment must not orphan a teacher's ability to mark
    // attendance on it.
    const owned =
      lesson.teacherId === sessionUser.id || lesson.group?.teacherId === sessionUser.id;
    if (!owned) {
      return { error: "Занятие не принадлежит преподавателю" };
    }
  }

  const hasGradingFields =
    parsed.data.grade !== undefined ||
    parsed.data.homeworkCompleted !== undefined ||
    parsed.data.comment !== undefined;

  let billingWarning: string | undefined;

  try {
    if (parsed.data.status !== undefined) {
      await BillingService.markAttendanceAndCharge(lessonId, studentId, parsed.data.status);
    } else if (hasGradingFields) {
      // Grading/homework/comment requires an Attendance row. If the teacher
      // never touched the status dropdown (it visually defaults to PRESENT
      // but isn't persisted until an explicit change), materialize the row
      // now via the same billing path a real PRESENT selection would take --
      // grading a student implies they attended, keeping billing state
      // consistent instead of failing the save outright.
      await BillingService.markAttendanceAndCharge(lessonId, studentId, "PRESENT");
    }
  } catch (err) {
    // Billing (balance/freeze/pricing) is a downstream concern -- a billing
    // failure must never block the teacher from recording that a student
    // attended, was graded, or got homework/comments noted. Fall back to a
    // plain, unbilled attendance row and surface a soft warning instead of
    // failing the whole save.
    log.warn("Списание не выполнено, посещаемость сохранена без списания", {
      lessonId,
      studentId,
      error: err instanceof Error ? err.message : String(err),
    });
    billingWarning =
      "Посещаемость сохранена, но списание не выполнено — проверьте баланс ученика";

    const fallbackStatus = parsed.data.status ?? "PRESENT";
    try {
      await db.attendance.upsert({
        where: {
          classSessionId_studentId: { classSessionId: lessonId, studentId },
        },
        update: { status: fallbackStatus },
        create: {
          classSessionId: lessonId,
          studentId,
          status: fallbackStatus,
          priceAtTime: 0,
        },
      });
    } catch (fallbackErr) {
      return {
        error:
          fallbackErr instanceof Error
            ? fallbackErr.message
            : "Не удалось обновить посещаемость",
      };
    }
  }

  if (hasGradingFields) {
    const updateData: {
      grade?: number | null;
      homeworkCompleted?: boolean;
      comment?: string | null;
    } = {};
    if (parsed.data.grade !== undefined) updateData.grade = parsed.data.grade;
    if (parsed.data.homeworkCompleted !== undefined) {
      updateData.homeworkCompleted = parsed.data.homeworkCompleted;
    }
    if (parsed.data.comment !== undefined) updateData.comment = parsed.data.comment;

    try {
      await db.attendance.update({
        where: {
          classSessionId_studentId: { classSessionId: lessonId, studentId },
        },
        data: updateData,
      });
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Не удалось обновить посещаемость",
      };
    }
  }

  revalidatePath(`/lessons/${lessonId}`);
  return billingWarning ? { warning: billingWarning } : {};
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
      classSession: {
        select: {
          groupId: true,
          teacherId: true,
          scheduledAt: true,
          durationMinutes: true,
          group: { select: { teacherId: true } },
        },
      },
    },
  });
  if (!attendance) {
    return { error: "Запись посещаемости не найдена" };
  }

  // Past-lesson lock: assigning a makeup for an absence on a lesson that has
  // already concluded is still "editing" that lesson's attendance -- only
  // ADMIN may do so once it's finished.
  if (
    sessionUser.role !== "ADMIN" &&
    attendance.classSession?.scheduledAt &&
    isLessonConcluded(attendance.classSession.scheduledAt, attendance.classSession.durationMinutes)
  ) {
    return { error: "Редактирование прошедших занятий доступно только администратору" };
  }

  const ownedByTeacher =
    attendance.classSession?.teacherId === sessionUser.id ||
    attendance.classSession?.group?.teacherId === sessionUser.id;
  if (sessionUser.role === "TEACHER" && !ownedByTeacher) {
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

// Shared by gradeSubmission and getSubmissionFileUrl: fetches the submission
// plus enough of its lesson to run the same teacher-ownership check used
// elsewhere in this file (setAttendance) -- a group reassignment must not
// orphan a teacher's ability to grade work tied to it.
type SubmissionForGrading = {
  id: string;
  lessonId: string;
  fileKey: string | null;
  scheduledAt: Date;
  durationMinutes: number;
};

async function loadSubmissionForGrading(
  submissionId: string,
  sessionUser: { id: string; role: string },
): Promise<{ ok: true; submission: SubmissionForGrading } | { ok: false; error: string }> {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      lessonId: true,
      fileKey: true,
      lesson: {
        select: {
          teacherId: true,
          scheduledAt: true,
          durationMinutes: true,
          group: { select: { teacherId: true } },
        },
      },
    },
  });
  if (!submission) return { ok: false, error: "Работа не найдена" };

  if (sessionUser.role === "TEACHER") {
    const owned =
      submission.lesson.teacherId === sessionUser.id ||
      submission.lesson.group?.teacherId === sessionUser.id;
    if (!owned) {
      return { ok: false, error: "Занятие не принадлежит преподавателю" };
    }
  }

  return {
    ok: true,
    submission: {
      id: submission.id,
      lessonId: submission.lessonId,
      fileKey: submission.fileKey,
      scheduledAt: submission.lesson.scheduledAt,
      durationMinutes: submission.lesson.durationMinutes,
    },
  };
}

export async function gradeSubmission(values: {
  submissionId: string;
  status: SubmissionStatus;
  score?: number | null;
  teacherComment?: string | null;
}): Promise<ActionResult> {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  const parsed = gradeSubmissionSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const result = await loadSubmissionForGrading(parsed.data.submissionId, sessionUser);
  if (!result.ok) return { error: result.error };

  // Past-lesson lock: grading is editing, not viewing (that's
  // getSubmissionFileUrl, which never checks this) -- only ADMIN may grade
  // once the lesson has already concluded.
  if (
    sessionUser.role !== "ADMIN" &&
    isLessonConcluded(result.submission.scheduledAt, result.submission.durationMinutes)
  ) {
    return { error: "Редактирование прошедших занятий доступно только администратору" };
  }

  const updateData: {
    status: SubmissionStatus;
    gradedById: string;
    score?: number | null;
    teacherComment?: string | null;
  } = {
    status: parsed.data.status,
    gradedById: sessionUser.id,
  };
  if (parsed.data.score !== undefined) updateData.score = parsed.data.score;
  if (parsed.data.teacherComment !== undefined) {
    updateData.teacherComment = parsed.data.teacherComment;
  }

  try {
    await db.submission.update({
      where: { id: parsed.data.submissionId },
      data: updateData,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Не удалось сохранить оценку" };
  }

  revalidatePath(`/lessons/${result.submission.lessonId}`);
  return {};
}

// Mints a short-lived signed GET URL so a teacher/admin can view a student's
// uploaded homework file without ever storing (or exposing) a public URL --
// same read pattern as LessonAsset's PDF viewer.
export async function getSubmissionFileUrl(
  submissionId: string,
): Promise<{ error: string } | { error?: undefined; url: string }> {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  const result = await loadSubmissionForGrading(submissionId, sessionUser);
  if (!result.ok) return { error: result.error };
  if (!result.submission.fileKey) {
    return { error: "К этой работе не прикреплён файл" };
  }

  try {
    // Lazy-imported: the R2 client throws at module load if its env vars are
    // unset, and eagerly importing it here would break every test/page that
    // merely imports this actions.ts file for its other, unrelated exports.
    const { signGetObject } = await import("@/lms/server/r2/signed");
    const url = await signGetObject(result.submission.fileKey);
    return { url };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось открыть файл",
    };
  }
}

const HOMEWORK_FILE_MAX_SIZE_BYTES = 25 * 1024 * 1024;

function safeHomeworkFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
}

// Shared by getHomeworkUploadUrl and attachHomeworkFile: confirms the lesson
// exists and, for a TEACHER, that they own it -- same ownership pattern as
// setAttendance/loadSubmissionForGrading in this file.
async function loadLessonForHomeworkUpload(
  lessonId: string,
  sessionUser: { id: string; role: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const lesson = await db.classSession.findUnique({
    where: { id: lessonId },
    select: {
      teacherId: true,
      scheduledAt: true,
      durationMinutes: true,
      group: { select: { teacherId: true } },
    },
  });
  if (!lesson) return { ok: false, error: "Занятие не найдено" };

  // Past-lesson lock: attaching/replacing a homework file is editing -- only
  // ADMIN may do so once the lesson has already concluded.
  if (sessionUser.role !== "ADMIN" && isLessonConcluded(lesson.scheduledAt, lesson.durationMinutes)) {
    return { ok: false, error: "Редактирование прошедших занятий доступно только администратору" };
  }

  if (sessionUser.role === "TEACHER") {
    const owned = lesson.teacherId === sessionUser.id || lesson.group?.teacherId === sessionUser.id;
    if (!owned) return { ok: false, error: "Занятие не принадлежит преподавателю" };
  }

  return { ok: true };
}

// Mints a presigned PUT URL so a teacher/admin can attach a student's
// homework file directly from the CRM journal -- same key convention as the
// student-side getSubmissionUploadUrl (app/crm/(student)/portal/actions.ts):
// homework-submissions/{lessonId}/{studentId}/{uuid}-{safeName}.
export async function getHomeworkUploadUrl(
  lessonId: string,
  studentId: string,
  file: { name: string; mimeType: string; sizeBytes: number },
): Promise<
  | { error: string }
  | { error?: undefined; uploadUrl: string; fileKey: string; fileName: string }
> {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  const owned = await loadLessonForHomeworkUpload(lessonId, sessionUser);
  if (!owned.ok) return { error: owned.error };

  if (!Number.isFinite(file.sizeBytes) || file.sizeBytes <= 0) {
    return { error: "Некорректный размер файла" };
  }
  if (file.sizeBytes > HOMEWORK_FILE_MAX_SIZE_BYTES) {
    return { error: "Файл слишком большой (максимум 25 МБ)" };
  }

  const fileName = safeHomeworkFileName(file.name);
  const fileKey = `homework-submissions/${lessonId}/${studentId}/${crypto.randomUUID()}-${fileName}`;

  try {
    const { signPutObject } = await import("@/lms/server/r2/signed");
    const uploadUrl = await signPutObject(fileKey, file.mimeType);
    return { uploadUrl, fileKey, fileName };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось подготовить загрузку файла",
    };
  }
}

// Persists (or clears, with fileKey=null) the fileKey a teacher/admin just
// uploaded. Upserts because a teacher may attach a file before the student
// has ever submitted anything (no Submission row exists yet).
export async function attachHomeworkFile(
  lessonId: string,
  studentId: string,
  fileKey: string | null,
): Promise<ActionResult> {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  const owned = await loadLessonForHomeworkUpload(lessonId, sessionUser);
  if (!owned.ok) return { error: owned.error };

  // IDOR guard: the only legitimate source of fileKey is getHomeworkUploadUrl,
  // which always mints keys scoped to this exact prefix.
  if (fileKey !== null && !fileKey.startsWith(`homework-submissions/${lessonId}/${studentId}/`)) {
    return { error: "Некорректный ключ файла" };
  }

  try {
    await db.submission.upsert({
      where: { lessonId_studentId: { lessonId, studentId } },
      update: { fileKey },
      create: { lessonId, studentId, fileKey, status: "SUBMITTED" },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось прикрепить файл",
    };
  }

  revalidatePath(`/lessons/${lessonId}`);
  return {};
}
