"use server";

import { revalidatePath } from "next/cache";
import type { AttendanceStatus, SubmissionStatus } from "@prisma/client";
import {
  lessonSchema,
  makeupSchema,
  setAttendanceUpdateSchema,
  gradeSubmissionSchema,
  bulkCancelWithReasonSchema,
  reassignTeacherSchema,
  updateLessonSchema,
  updateLessonHomeworkSchema,
  duplicateWeekScheduleSchema,
  type LessonValues,
} from "@/crm/lib/schemas";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { BillingService } from "@/crm/lib/services/billing.service";
import { formatMoscowDate, formatMoscowTime, moscowDateTimeToUtc } from "@/shared/lib/timezone";
import { isAttendanceWindowOpen } from "@/crm/lib/lessonTime";
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
export async function findTeacherScheduleConflict(
  teacherId: string,
  occurrences: Occurrence[],
  excludeSessionIds?: string[],
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
      ...(excludeSessionIds && excludeSessionIds.length > 0
        ? { id: { notIn: excludeSessionIds } }
        : {}),
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
    isFree: boolean;
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
    // acknowledgement before the lesson is created at 0 ₽ -- unless the
    // lesson is explicitly marked free, which needs no rate at all.
    const isFree = parsed.data.isFree ?? false;
    // A manually entered price always wins: staff typing a rate up front
    // must never be blocked by "no price history", and never needs the
    // missing-price-history warning below.
    const manualPrice = parsed.data.pricePerLesson;
    let resolvedPrice: number | null;
    if (isFree || manualPrice !== undefined) {
      resolvedPrice = manualPrice ?? null;
    } else {
      resolvedPrice = await getLastIndividualLessonPrice(studentId);
      if (resolvedPrice === null && !parsed.data.acknowledgeMissingPrice) {
        return {
          missingPriceWarning: { studentId, studentName: student.fullName },
        };
      }
    }

    teacherId = chosenTeacherId;
    sessionLink = {
      type: "INDIVIDUAL",
      groupId: null,
      studentId,
      pricePerLesson: resolvedPrice ?? 0,
      isTrial: parsed.data.isTrial ?? false,
      isFree,
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
      isFree: parsed.data.isFree ?? false,
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
        isFree: sessionLink.isFree,
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
  const sessionUser = await requireRole(["ADMIN", "MANAGER"]);

  // No scheduledAt/future restriction here on purpose: a lesson that was
  // entered by mistake (duplicate, wrong group, wrong date) is often only
  // noticed after it's already passed, and an operator must still be able to
  // pull it out of the schedule. What DOES stay guarded (for non-ADMIN roles)
  // is attendance: once a session has any Attendance rows, cancelling it
  // would silently orphan billing/salary history
  // (BillingService.markAttendanceAndCharge already ran), so that case is
  // blocked instead of allowed to corrupt those records. An ADMIN gets an
  // explicit escape hatch below instead of this guard.
  const session = await db.classSession.findUnique({
    where: { id: lessonId },
    select: {
      status: true,
      _count: { select: { attendance: true } },
      attendance: { select: { id: true, studentId: true } },
      transactions: { where: { type: "LESSON_CHARGE" }, select: { id: true, studentId: true, amount: true } },
    },
  });
  if (!session) {
    return { error: "Занятие не найдено" };
  }

  const isAdmin = sessionUser.role === "ADMIN";

  if (!isAdmin) {
    if (session.status !== "scheduled") {
      return { error: "Занятие уже отменено" };
    }
    if (session._count.attendance > 0) {
      return {
        error:
          "У занятия уже отмечена посещаемость — отмена недоступна, чтобы не исказить начисления",
      };
    }
  }

  // A still-scheduled session with no attendance yet has nothing to purge --
  // behave exactly as before (soft-cancel), for admins too.
  if (session.status === "scheduled" && session._count.attendance === 0) {
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

  // ADMIN-only purge path: reached either because the session already has
  // attendance (bypassing the guard above) or because it's already cancelled
  // and the admin wants it fully removed. Every existing LESSON_CHARGE is
  // reversed with an audited compensating ADJUSTMENT (never deleted --
  // preserves the financial ledger, same pattern as
  // bulkCancelSessionsWithBilling), then the Attendance rows are cascade
  // deleted and the ClassSession row itself is hard-deleted. Transaction rows
  // are never touched by the session delete itself: Transaction.classSession
  // is onDelete:SetNull in the schema, so they survive with classSessionId
  // cleared rather than being destroyed or blocking the delete.
  try {
    await db.$transaction(async (tx) => {
      for (const charge of session.transactions) {
        await tx.transaction.create({
          data: {
            studentId: charge.studentId,
            classSessionId: lessonId,
            amount: -Number(charge.amount),
            type: "ADJUSTMENT",
            idempotencyKey: `lesson_purge_adjustment:${lessonId}:${charge.studentId}`,
            description: "Возврат за удалённое занятие (административное удаление)",
          },
        });
      }
      await tx.attendance.deleteMany({ where: { classSessionId: lessonId } });
      await tx.classSession.delete({ where: { id: lessonId } });
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось удалить занятие",
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

export type BulkCancelWithBillingResult =
  | { error: string }
  | { error?: undefined; cancelledCount: number; skippedCount: number };

const CANCEL_CHUNK_SIZE = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Cancels a batch of sessions that may already carry billed attendance --
 * unlike bulkCancelSessions (future-only, never-attended), this is the path
 * for cancelling lessons that already happened or were already charged.
 * Every LESSON_CHARGE transaction on a cancelled session is reversed with a
 * compensating ADJUSTMENT transaction (never deleted, preserving the audit
 * trail) inside the same per-session transaction that flips its status.
 * Batches run in chunks of CANCEL_CHUNK_SIZE, each its own transaction, so a
 * large selection can't time out a single Server Action request.
 *
 * NOTE: as of this writing, LessonsClient restricts bulk-cancel selection to
 * future/unattended sessions (same restriction as bulkCancelSessions), so no
 * selectable session currently has a LESSON_CHARGE to reverse -- this
 * action's refund-reversal logic is written for future support of
 * past/attended-lesson cancellation and is not yet reachable through the UI.
 * This is a deliberate, confirmed scope decision, not a bug -- do not change
 * the selection rule or attempt to reconcile teacher payouts as part of
 * fixing an unrelated issue in this file.
 */
export async function bulkCancelSessionsWithBilling(input: {
  sessionIds: string[];
  reason: string;
}): Promise<BulkCancelWithBillingResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  const parsed = bulkCancelWithReasonSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  let cancelledCount = 0;
  let skippedCount = 0;

  for (const idsChunk of chunk(parsed.data.sessionIds, CANCEL_CHUNK_SIZE)) {
    try {
      const chunkResult = await db.$transaction(async (tx) => {
        const targets = await tx.classSession.findMany({
          where: { id: { in: idsChunk } },
          select: {
            id: true,
            status: true,
            transactions: { where: { type: "LESSON_CHARGE" }, select: { id: true, studentId: true, amount: true } },
          },
        });

        let chunkCancelled = 0;
        for (const target of targets) {
          if (target.status !== "scheduled") continue;

          for (const charge of target.transactions) {
            await tx.transaction.create({
              data: {
                studentId: charge.studentId,
                classSessionId: target.id,
                amount: -Number(charge.amount),
                type: "ADJUSTMENT",
                // Deterministic per (session, student): guards against ever
                // double-crediting the same cancelled charge.
                idempotencyKey: `lesson_cancel_adjustment:${target.id}:${charge.studentId}`,
                description: `Возврат за отменённое занятие: ${parsed.data.reason}`,
              },
            });
          }

          await tx.classSession.update({ where: { id: target.id }, data: { status: "cancelled" } });
          chunkCancelled += 1;
        }

        return { cancelled: chunkCancelled, skipped: targets.length - chunkCancelled };
      });

      cancelledCount += chunkResult.cancelled;
      skippedCount += chunkResult.skipped;
    } catch (err) {
      log.error("Не удалось отменить часть занятий", err, { idsChunk });
      skippedCount += idsChunk.length;
    }
  }

  revalidatePath("/lessons");
  revalidatePath("/schedule");
  revalidatePath("/groups");
  return { cancelledCount, skippedCount };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type DuplicateWeekScheduleResult =
  | { error: string }
  | { error?: undefined; eligibleCount: number; clonedCount: number; skippedCount: number };

/**
 * Clones every eligible SCHEDULED, non-trial session from the Moscow week
 * starting `sourceWeekStart` (a YYYY-MM-DD Monday key) into the following
 * week, 7 days later at the same wall-clock time. Excludes trials
 * (isTrial), cancelled sessions, and makeup sessions (identified as being
 * the *target* of a MakeupLesson row -- makeupTargetFor: { none: {} }).
 * Idempotent: a session already existing for the same teacher + group/
 * student at the exact target time is skipped, not duplicated. Runs in
 * CANCEL_CHUNK_SIZE-sized transactions (same pattern as
 * bulkCancelSessionsWithBilling) so a large week can't time out one
 * request. dryRun: true runs the full scan (including the per-session
 * duplicate check) without writing, for the UI's confirmation preview.
 */
export async function duplicateWeekScheduleAction(
  input: { sourceWeekStart: string; dryRun?: boolean },
): Promise<DuplicateWeekScheduleResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  const parsed = duplicateWeekScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const sourceStart = moscowDateTimeToUtc(parsed.data.sourceWeekStart, "00:00");
  const sourceEnd = new Date(sourceStart.getTime() + WEEK_MS);

  const candidates = await db.classSession.findMany({
    where: {
      status: "scheduled",
      isTrial: false,
      makeupTargetFor: { none: {} },
      scheduledAt: { gte: sourceStart, lt: sourceEnd },
    },
    select: {
      id: true,
      type: true,
      groupId: true,
      studentId: true,
      teacherId: true,
      scheduledAt: true,
      durationMinutes: true,
      pricePerLesson: true,
      isFree: true,
    },
  });

  if (candidates.length === 0) {
    return { eligibleCount: 0, clonedCount: 0, skippedCount: 0 };
  }

  let clonedCount = 0;
  let skippedCount = 0;

  for (const batch of chunk(candidates, CANCEL_CHUNK_SIZE)) {
    const batchResult = await db.$transaction(async (tx) => {
      let cloned = 0;
      let skipped = 0;
      for (const session of batch) {
        const targetScheduledAt = new Date(session.scheduledAt.getTime() + WEEK_MS);
        const existing = await tx.classSession.findFirst({
          where: {
            teacherId: session.teacherId,
            scheduledAt: targetScheduledAt,
            ...(session.groupId ? { groupId: session.groupId } : { studentId: session.studentId }),
          },
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
        if (!parsed.data.dryRun) {
          await tx.classSession.create({
            data: {
              type: session.type,
              groupId: session.groupId,
              studentId: session.studentId,
              teacherId: session.teacherId,
              scheduledAt: targetScheduledAt,
              durationMinutes: session.durationMinutes,
              pricePerLesson: session.pricePerLesson,
              isFree: session.isFree,
              reminderSentAt: null,
            },
          });
        }
        cloned += 1;
      }
      return { cloned, skipped };
    });
    clonedCount += batchResult.cloned;
    skippedCount += batchResult.skipped;
  }

  if (!parsed.data.dryRun) {
    revalidatePath("/schedule");
    revalidatePath("/lessons");
  }

  return { eligibleCount: candidates.length, clonedCount, skippedCount };
}

export type UpdateLessonResult = { error: string } | { error?: undefined };

/**
 * Narrow edit for a lesson that hasn't been marked yet: price/isFree, and/or
 * an in-place reschedule (date/time/duration). ADMIN/MANAGER only. Blocked
 * entirely once any Attendance row for the session has a non-null status --
 * editing anything (pricing or timing) after real marking would silently
 * desync it from whatever was already charged/notified; staff must revert
 * attendance to null first (existing setAttendance flow) if they truly need
 * to change it, then re-mark it. GROUP sessions never take their own price
 * (that's Group.pricePerLesson) -- only isFree is settable for a single
 * occurrence. A reschedule reuses createLesson's own teacher-collision check
 * (excluding the session being moved), run against the lesson's final
 * effective window -- final scheduledAt + final durationMinutes -- whenever
 * either actually changes, so a duration-only extension that leaves the
 * start time untouched is still re-checked. Resets reminderSentAt so the
 * lesson-reminders cron re-notifies for the new time.
 */
export async function updateLesson(
  classSessionId: string,
  values: {
    pricePerLesson?: number;
    isFree?: boolean;
    date?: string;
    time?: string;
    durationMinutes?: number;
  },
): Promise<UpdateLessonResult> {
  const sessionUser = await requireRole(["ADMIN", "MANAGER"]);

  const parsed = updateLessonSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные занятия" };
  }

  const session = await db.classSession.findUnique({
    where: { id: classSessionId },
    select: {
      type: true,
      teacherId: true,
      scheduledAt: true,
      durationMinutes: true,
      _count: { select: { attendance: { where: { status: { not: null } } } } },
    },
  });
  if (!session) {
    return { error: "Занятие не найдено" };
  }
  if (session._count.attendance > 0) {
    return { error: "Нельзя изменить занятие после отметки посещаемости" };
  }
  if (session.type === "GROUP" && parsed.data.pricePerLesson !== undefined) {
    return { error: "Цена группового занятия задаётся в настройках группы" };
  }

  const data: {
    pricePerLesson?: number;
    isFree?: boolean;
    scheduledAt?: Date;
    durationMinutes?: number;
    reminderSentAt?: null;
  } = {};
  if (session.type === "INDIVIDUAL" && parsed.data.pricePerLesson !== undefined) {
    data.pricePerLesson = parsed.data.pricePerLesson;
  }
  if (parsed.data.isFree !== undefined) {
    data.isFree = parsed.data.isFree;
  }

  const auditRows: { field: string; oldValue: string; newValue: string }[] = [];

  const newScheduledAt =
    parsed.data.date && parsed.data.time
      ? moscowDateTimeToUtc(parsed.data.date, parsed.data.time)
      : undefined;
  const scheduledAtChanged =
    newScheduledAt !== undefined && newScheduledAt.getTime() !== session.scheduledAt.getTime();
  const durationChanged =
    parsed.data.durationMinutes !== undefined &&
    parsed.data.durationMinutes !== session.durationMinutes;

  // The collision check must cover the lesson's actual final occupied
  // window -- start time AND duration -- whenever either one actually
  // changes. Checking only on a start-time change would miss a duration-only
  // extension (start left alone) that grows the window into another of the
  // teacher's sessions; the reverse (only checking on duration change) would
  // miss a plain move. Whichever half didn't change keeps its stored value,
  // so a duration-only edit is still checked against the *existing*
  // (unchanged) start time, and vice versa.
  if (scheduledAtChanged || durationChanged) {
    const finalScheduledAt = newScheduledAt ?? session.scheduledAt;
    const finalDuration = parsed.data.durationMinutes ?? session.durationMinutes;

    const conflict = await findTeacherScheduleConflict(
      session.teacherId,
      [{ scheduledAt: finalScheduledAt, durationMinutes: finalDuration }],
      [classSessionId],
    );
    if (conflict) {
      return {
        error: `Преподаватель уже занят ${formatMoscowDate(conflict.scheduledAt)} в ${formatMoscowTime(
          conflict.scheduledAt,
        )}. Выберите другое время.`,
      };
    }

    if (scheduledAtChanged) {
      data.scheduledAt = finalScheduledAt;
      // Only a future move needs to re-arm the reminders cron; a backfilled
      // past move never should have (and shouldn't newly) send a reminder.
      data.reminderSentAt = finalScheduledAt > new Date() ? null : undefined;
      auditRows.push({
        field: "scheduledAt",
        oldValue: session.scheduledAt.toISOString(),
        newValue: finalScheduledAt.toISOString(),
      });
    }

    if (durationChanged) {
      data.durationMinutes = finalDuration;
      auditRows.push({
        field: "durationMinutes",
        oldValue: String(session.durationMinutes),
        newValue: String(finalDuration),
      });
    }
  }

  try {
    if (auditRows.length > 0) {
      await db.$transaction(async (tx) => {
        await tx.classSession.update({ where: { id: classSessionId }, data });
        await tx.lessonAuditLog.createMany({
          data: auditRows.map((row) => ({
            classSessionId,
            field: row.field,
            oldValue: row.oldValue,
            newValue: row.newValue,
            changedById: sessionUser.id,
          })),
        });
      });
    } else {
      await db.classSession.update({ where: { id: classSessionId }, data });
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Не удалось обновить занятие" };
  }

  revalidatePath(`/lessons/${classSessionId}`);
  revalidatePath("/schedule");
  return {};
}

/**
 * Saves the lesson-level homework text (what was assigned to the whole
 * class/individual student), distinct from Attendance.homeworkCompleted's
 * per-student completion checkbox. ADMIN/MANAGER/TEACHER, same ownership
 * rule as setAttendance -- a TEACHER may only edit a lesson they own
 * (directly, or via the group's current teacher).
 */
export async function updateLessonHomework(
  lessonId: string,
  homework: string,
): Promise<ActionResult> {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  const parsed = updateLessonHomeworkSchema.safeParse({ homework });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const lesson = await db.classSession.findUnique({
    where: { id: lessonId },
    select: { teacherId: true, group: { select: { teacherId: true } } },
  });
  if (!lesson) {
    return { error: "Занятие не найдено" };
  }
  if (sessionUser.role === "TEACHER") {
    const owned =
      lesson.teacherId === sessionUser.id || lesson.group?.teacherId === sessionUser.id;
    if (!owned) {
      return { error: "Занятие не принадлежит преподавателю" };
    }
  }

  const trimmed = parsed.data.homework?.trim();

  try {
    await db.classSession.update({
      where: { id: lessonId },
      data: { homework: trimmed ? trimmed : null },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось сохранить домашнее задание",
    };
  }

  revalidatePath(`/lessons/${lessonId}`);
  return {};
}

export async function setAttendance(
  lessonId: string,
  studentId: string,
  update: {
    status?: AttendanceStatus | null;
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

  // RBAC: CANCELLED_BY_CENTER is an ADMIN/MANAGER-only action (cancelling a
  // lesson center-wide isn't a TEACHER's call) -- unlike EXCUSED, which any
  // owning role may set. Unconditional on lesson timing: a TEACHER can't set
  // this after the fact either.
  if (sessionUser.role === "TEACHER" && parsed.data.status === "CANCELLED_BY_CENTER") {
    return { error: "Отмена центром доступна только администраторам" };
  }

  const hasGradingFields =
    parsed.data.grade !== undefined ||
    parsed.data.homeworkCompleted !== undefined ||
    parsed.data.comment !== undefined;

  const windowOpen = isAttendanceWindowOpen({ scheduledAt: lesson.scheduledAt });
  const requestsBillableStatus =
    parsed.data.status === "PRESENT" || parsed.data.status === "ABSENT";

  // Zero Future Billing invariant: PRESENT/ABSENT can never be set -- nor
  // implicitly triggered by a grading-field save below -- before a lesson's
  // attendance window opens. No role exception. EXCUSED/CANCELLED_BY_CENTER
  // stay unblocked since BillingService never charges them regardless of
  // timing.
  if (!windowOpen && requestsBillableStatus) {
    return { error: "Нельзя отметить посещаемость занятия до его начала" };
  }

  let billingWarning: string | undefined;
  let billingAttempted = false;

  try {
    if (parsed.data.status === null) {
      // Explicit revert to "unmarked" -- undoing an advance EXCUSED/
      // CANCELLED_BY_CENTER mark before the lesson's window opens (or, for
      // ADMIN, any time). A null status is never billable, so this never
      // routes through BillingService; upsert (not update) so reverting a
      // lesson that was never marked at all is a harmless no-op rather than
      // a P2025 "record not found".
      await db.attendance.upsert({
        where: {
          classSessionId_studentId: { classSessionId: lessonId, studentId },
        },
        update: { status: null },
        create: {
          classSessionId: lessonId,
          studentId,
          status: null,
          priceAtTime: 0,
        },
      });
    } else if (parsed.data.status !== undefined) {
      billingAttempted = true;
      await BillingService.markAttendanceAndCharge(lessonId, studentId, parsed.data.status);
    } else if (hasGradingFields && windowOpen) {
      // Grading/homework/comment requires an Attendance row. If the teacher
      // never touched the status dropdown (it visually defaults to PRESENT
      // but isn't persisted until an explicit change), materialize the row
      // now via the same billing path a real PRESENT selection would take --
      // grading a student implies they attended, keeping billing state
      // consistent instead of failing the save outright.
      billingAttempted = true;
      await BillingService.markAttendanceAndCharge(lessonId, studentId, "PRESENT");
    } else if (hasGradingFields) {
      // Lesson hasn't reached its attendance window yet -- grading fields
      // (a pre-lesson comment/homework note) may still be saved, but must
      // NOT imply the student was PRESENT or trigger a charge. Materialize
      // an unmarked stub row (status null) so the grade/comment/homework
      // update below has a row to attach to. No BillingService call happens
      // in this branch, so a failure here is a plain save failure, not a
      // billing failure -- billingAttempted stays false.
      await db.attendance.upsert({
        where: {
          classSessionId_studentId: { classSessionId: lessonId, studentId },
        },
        update: {},
        create: {
          classSessionId: lessonId,
          studentId,
          status: null,
          priceAtTime: 0,
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // The zero-price billing guard (BillingService.markAttendanceAndCharge)
    // rejects before any write, by design -- staff must fix the session's
    // price/isFree first. Falling through to the generic billing-failure
    // fallback below would silently persist an unbilled PRESENT anyway (via
    // fallbackStatus), show a misleading "check the balance" message, and --
    // once that status exists -- lock updateLesson's price/isFree editor,
    // trapping staff with no way to fix the price without first reverting
    // attendance to null. Fail the whole save cleanly instead.
    if (billingAttempted && message.includes("не помеченное как бесплатное")) {
      // TEACHER can't set a price or mark a lesson free themselves (that's
      // updateLesson, ADMIN/MANAGER-only) -- pointing them at "set the
      // price" would send them to a control they don't have. Redirect to
      // an administrator instead of repeating the ADMIN/MANAGER-facing copy.
      if (sessionUser.role === "TEACHER") {
        return {
          error:
            "Стоимость урока не указана. Обратитесь к администратору для установки цены перед отметкой посещаемости.",
        };
      }
      return {
        error:
          "У занятия нулевая цена, и оно не помечено как бесплатное. Установите цену или отметьте занятие бесплатным, затем повторите отметку.",
      };
    }

    // Billing (balance/freeze/pricing) is a downstream concern -- a billing
    // failure must never block the teacher from recording that a student
    // attended, was graded, or got homework/comments noted. Fall back to a
    // plain, unbilled attendance row and surface a soft warning instead of
    // failing the whole save.
    //
    // The message differs depending on whether billing was even attempted:
    // the future-lesson, grading-only stub-upsert above never calls
    // BillingService, so a failure there is a save failure, not a billing
    // failure -- claiming "списание не выполнено" in that case would send a
    // teacher to check a student balance that was never at issue.
    if (billingAttempted) {
      log.warn("Списание не выполнено, посещаемость сохранена без списания", {
        lessonId,
        studentId,
        error: err instanceof Error ? err.message : String(err),
      });
      billingWarning =
        "Посещаемость сохранена, но списание не выполнено — проверьте баланс ученика";
    } else {
      log.warn("Не удалось сохранить посещаемость", {
        lessonId,
        studentId,
        error: err instanceof Error ? err.message : String(err),
      });
      billingWarning = "Посещаемость сохранена не полностью — попробуйте обновить страницу";
    }

    // `??` would be wrong here: an explicit `status: null` (a revert
    // request) is nullish, so `parsed.data.status ?? (windowOpen ? ... :
    // null)` would silently override it with "PRESENT" on an open window,
    // re-marking a student the caller just tried to un-mark. Only fall back
    // to the windowOpen-based default when status was never provided at all.
    const fallbackStatus =
      parsed.data.status !== undefined
        ? parsed.data.status
        : windowOpen
          ? "PRESENT"
          : null;
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

export type ReassignTeacherResult =
  | { error: string }
  | { error?: undefined; reassignedCount: number; skippedCount: number };

/**
 * Bulk-moves INDIVIDUAL sessions to a new teacher, admin/manager only. GROUP
 * sessions are rejected outright: a session's own teacherId is only a
 * display fallback (see getTeacherLabel in LessonsClient.tsx) -- the group's
 * OWN teacherId is what actually drives who teaches it, so reassigning a
 * GROUP session's row here would silently have no visible effect. Every
 * remaining session is checked against the new teacher's existing scheduled
 * sessions for a time overlap before anything is moved; a single conflict
 * blocks the whole batch (never a silent partial reassignment) so the
 * operator can resolve the exact conflicting time and retry.
 */
export async function reassignTeacher(input: {
  sessionIds: string[];
  newTeacherId: string;
}): Promise<ReassignTeacherResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  const parsed = reassignTeacherSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const teacher = await db.user.findFirst({
    where: { id: parsed.data.newTeacherId, role: "TEACHER" },
    select: { id: true },
  });
  if (!teacher) {
    return { error: "Преподаватель не найден" };
  }

  const targets = await db.classSession.findMany({
    where: { id: { in: parsed.data.sessionIds } },
    select: { id: true, type: true, status: true, scheduledAt: true, durationMinutes: true },
  });

  const eligible = targets.filter((t) => t.type === "INDIVIDUAL" && t.status === "scheduled");
  const skippedCount = targets.length - eligible.length;

  if (eligible.length === 0) {
    return { reassignedCount: 0, skippedCount };
  }

  const conflict = await findTeacherScheduleConflict(
    parsed.data.newTeacherId,
    eligible.map((t) => ({ scheduledAt: t.scheduledAt, durationMinutes: t.durationMinutes })),
    eligible.map((t) => t.id),
  );
  if (conflict) {
    return {
      error: `Преподаватель уже занят ${formatMoscowDate(conflict.scheduledAt)} в ${formatMoscowTime(
        conflict.scheduledAt,
      )}. Отмените конфликт и повторите перенос.`,
    };
  }

  try {
    const result = await db.classSession.updateMany({
      where: { id: { in: eligible.map((t) => t.id) } },
      data: { teacherId: parsed.data.newTeacherId },
    });
    revalidatePath("/lessons");
    revalidatePath("/schedule");
    return { reassignedCount: result.count, skippedCount };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Не удалось сменить преподавателя" };
  }
}
