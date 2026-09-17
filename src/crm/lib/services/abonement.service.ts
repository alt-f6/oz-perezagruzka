import { db } from "@/shared/lib/db";
import { isLessonConcluded } from "@/crm/lib/lessonTime";
import { resolveSessionPrice } from "@/crm/lib/pricing";
import type { AttendanceStatus } from "@prisma/client";

export interface AbonementGroupBreakdown {
  groupId: string;
  groupName: string;
  pricePerLesson: number;
  // null when the group's price is unset/zero -- can't divide by it.
  remainingLessons: number | null;
}

export interface AbonementIndividualBreakdown {
  pricePerLesson: number;
  remainingLessons: number;
}

export type AbonementMode = "SINGLE_GROUP" | "MULTI_GROUP" | "INDIVIDUAL" | "MIXED" | "NONE";

export interface AbonementSummary {
  balance: number;
  mode: AbonementMode;
  groups: AbonementGroupBreakdown[];
  individual: AbonementIndividualBreakdown | null;
  // Lowest remaining-lessons figure across every breakdown; drives the
  // low-balance warning badge and the /students list filter. Null when it
  // can't be computed at all (no groups, no individual rate, or every group
  // price is unset).
  minRemainingLessons: number | null;
}

/** floor(balance / price), or null when price isn't a usable positive number. */
export function remainingLessonsFor(balance: number, pricePerLesson: number): number | null {
  if (!(pricePerLesson > 0)) return null;
  return Math.max(0, Math.floor(balance / pricePerLesson));
}

/**
 * Pure, list-friendly variant of the group-based calculation: the lowest
 * remaining-lessons figure across a student's groups, given their one shared
 * balance. Used by the /students list to flag "abonement running out"
 * without an extra per-row query. Individual-lesson-only students (no group
 * membership) are out of scope here since their rate isn't loaded by the
 * list query -- see computeAbonementSummary for the full picture shown on a
 * student's own profile page.
 */
export function computeMinGroupRemainingLessons(
  balance: number,
  groups: { pricePerLesson: number }[],
): number | null {
  const figures = groups
    .map((g) => remainingLessonsFor(balance, g.pricePerLesson))
    .filter((n): n is number => n !== null);
  return figures.length > 0 ? Math.min(...figures) : null;
}

/**
 * Full abonement summary for a student's profile card. The student's balance
 * is SHARED across every group they're in AND any individual-lesson rate --
 * a student with a group and an individual rate does not have "2x the
 * lessons" the balance alone would suggest. Every breakdown is computed
 * against the same shared balance and reported side-by-side (never summed).
 */
export async function computeAbonementSummary(studentId: string): Promise<AbonementSummary> {
  const [balanceAgg, groupLinks, individualPrice] = await Promise.all([
    db.transaction.aggregate({ where: { studentId }, _sum: { amount: true } }),
    db.groupStudent.findMany({
      where: { studentId, group: { deletedAt: null } },
      select: { group: { select: { id: true, name: true, pricePerLesson: true } } },
    }),
    getLastIndividualLessonPrice(studentId),
  ]);
  const balance = Number(balanceAgg._sum.amount ?? 0);

  const groups: AbonementGroupBreakdown[] = groupLinks.map(({ group }) => {
    const pricePerLesson = Number(group.pricePerLesson);
    return {
      groupId: group.id,
      groupName: group.name,
      pricePerLesson,
      remainingLessons: remainingLessonsFor(balance, pricePerLesson),
    };
  });

  const individualRemaining =
    individualPrice !== null ? remainingLessonsFor(balance, individualPrice) : null;
  const individual: AbonementIndividualBreakdown | null =
    individualPrice !== null && individualRemaining !== null
      ? { pricePerLesson: individualPrice, remainingLessons: individualRemaining }
      : null;

  const figures = [
    ...groups.map((g) => g.remainingLessons),
    ...(individual ? [individual.remainingLessons] : []),
  ].filter((n): n is number => n !== null);

  const mode: AbonementMode =
    groups.length > 0 && individual
      ? "MIXED"
      : groups.length > 1
        ? "MULTI_GROUP"
        : groups.length === 1
          ? "SINGLE_GROUP"
          : individual
            ? "INDIVIDUAL"
            : "NONE";

  return {
    balance,
    mode,
    groups,
    individual,
    minRemainingLessons: figures.length > 0 ? Math.min(...figures) : null,
  };
}

/**
 * The student's most recent non-trial INDIVIDUAL lesson price. There's no
 * dedicated per-student rate field, so "the last session's price" IS the
 * personal rate used both for the abonement summary and for auto-resolving
 * a new individual lesson's price (see createLesson). isTrial: false -- a
 * one-off discounted trial rate must never be projected as the ongoing rate.
 */
export async function getLastIndividualLessonPrice(studentId: string): Promise<number | null> {
  const lastIndividualSession = await db.classSession.findFirst({
    where: { studentId, type: "INDIVIDUAL", pricePerLesson: { not: null }, isTrial: false },
    orderBy: { scheduledAt: "desc" },
    select: { pricePerLesson: true },
  });
  return lastIndividualSession?.pricePerLesson != null
    ? Number(lastIndividualSession.pricePerLesson)
    : null;
}

export interface LedgerRow {
  id: string;
  date: string;
  kind: "SESSION" | "TRANSACTION";
  title: string;
  isGroup: boolean;
  teacherName: string | null;
  attendanceStatus: AttendanceStatus | null;
  amount: number;
  runningBalance: number;
}

/**
 * Chronological student ledger: every past/concluded session relevant to the
 * student (individual, or group via membership), each joined to their own
 * Attendance status and any LESSON_CHARGE, merged with standalone
 * PAYMENT/ADJUSTMENT/REFUND transactions. Session rows are ordered by
 * scheduledAt (when the lesson happened), standalone transactions by
 * createdAt -- a running balance is then accumulated in that combined
 * display order. Sessions with ClassSession.status "cancelled" never
 * appear (nothing happened for anyone); a per-student EXCUSED/
 * CANCELLED_BY_CENTER mark still shows, with its own status badge.
 */
export async function getStudentLedger(studentId: string): Promise<LedgerRow[]> {
  const now = new Date();

  const [sessions, standaloneTransactions] = await Promise.all([
    db.classSession.findMany({
      where: {
        status: { not: "cancelled" },
        OR: [{ studentId }, { group: { students: { some: { studentId } } } }],
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        type: true,
        group: { select: { name: true } },
        teacher: { select: { fullName: true } },
        attendance: { where: { studentId }, select: { status: true } },
        transactions: { where: { studentId }, select: { amount: true } },
      },
    }),
    db.transaction.findMany({
      where: { studentId, classSessionId: null, type: { in: ["PAYMENT", "ADJUSTMENT", "REFUND"] } },
      select: { id: true, amount: true, type: true, description: true, createdAt: true },
    }),
  ]);

  const sessionRows = sessions
    .filter((s) =>
      isLessonConcluded({ scheduledAt: s.scheduledAt, durationMinutes: s.durationMinutes }, now),
    )
    .map((s) => ({
      id: s.id,
      date: s.scheduledAt.toISOString(),
      kind: "SESSION" as const,
      title: s.group?.name ?? "Индивидуальное занятие",
      isGroup: s.type === "GROUP",
      teacherName: s.teacher?.fullName ?? null,
      attendanceStatus: s.attendance[0]?.status ?? null,
      amount: s.transactions.reduce((sum, t) => sum + Number(t.amount), 0),
    }));

  const transactionRows = standaloneTransactions.map((t) => ({
    id: t.id,
    date: t.createdAt.toISOString(),
    kind: "TRANSACTION" as const,
    title:
      t.description ??
      (t.type === "PAYMENT" ? "Оплата" : t.type === "REFUND" ? "Возврат" : "Корректировка"),
    isGroup: false,
    teacherName: null,
    attendanceStatus: null,
    amount: Number(t.amount),
  }));

  const merged = [...sessionRows, ...transactionRows].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  let running = 0;
  return merged.map((row) => {
    running += row.amount;
    return { ...row, runningBalance: running };
  });
}

export interface PendingChargePreview {
  count: number;
  projectedBalance: number;
}

/**
 * Preview for the ledger's "unmarked lessons" banner: how many of the
 * student's past/concluded sessions have no Attendance row for them yet, and
 * what their balance would become if every one of those were charged at its
 * resolved price. Uses the exact same resolveSessionPrice BillingService
 * charges with, so this preview can never disagree with the real charge.
 */
export async function getPendingChargePreview(
  studentId: string,
  currentBalance: number,
): Promise<PendingChargePreview> {
  const now = new Date();

  const [sessions, freezes] = await Promise.all([
    db.classSession.findMany({
      where: {
        status: { not: "cancelled" },
        OR: [{ studentId }, { group: { students: { some: { studentId } } } }],
      },
      select: {
        scheduledAt: true,
        durationMinutes: true,
        isFree: true,
        pricePerLesson: true,
        group: { select: { pricePerLesson: true } },
        attendance: { where: { studentId }, select: { status: true } },
      },
    }),
    db.freeze.findMany({ where: { studentId }, select: { startDate: true, endDate: true } }),
  ]);

  const unmarked = sessions.filter(
    (s) =>
      isLessonConcluded({ scheduledAt: s.scheduledAt, durationMinutes: s.durationMinutes }, now) &&
      s.attendance.length === 0,
  );

  // Mirrors BillingService.markAttendanceAndCharge's freeze check: a Freeze
  // covering the session's UTC calendar day suppresses the charge entirely,
  // so the preview must contribute 0 for that session too -- it still counts
  // toward `count` since staff still need to mark it.
  const projectedCharge = unmarked.reduce((sum, s) => {
    const sessionDay = new Date(
      Date.UTC(s.scheduledAt.getUTCFullYear(), s.scheduledAt.getUTCMonth(), s.scheduledAt.getUTCDate()),
    );
    const isFrozen = freezes.some((f) => f.startDate <= sessionDay && sessionDay <= f.endDate);
    return sum + (isFrozen ? 0 : Number(resolveSessionPrice(s)));
  }, 0);

  return { count: unmarked.length, projectedBalance: currentBalance - projectedCharge };
}
