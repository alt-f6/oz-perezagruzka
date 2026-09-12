import { db } from "@/shared/lib/db";

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

export type AbonementMode = "SINGLE_GROUP" | "MULTI_GROUP" | "INDIVIDUAL" | "NONE";

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
 * is SHARED across every group they're in -- a student in 2 groups does not
 * have "2x the lessons" the balance alone would suggest. Each group's
 * remaining-lessons figure is computed against the same shared balance and
 * reported side-by-side (never summed), so the UI can never imply doubled
 * prepaid lessons.
 */
export async function computeAbonementSummary(studentId: string): Promise<AbonementSummary> {
  const [balanceAgg, groupLinks] = await Promise.all([
    db.transaction.aggregate({ where: { studentId }, _sum: { amount: true } }),
    db.groupStudent.findMany({
      where: { studentId, group: { deletedAt: null } },
      select: { group: { select: { id: true, name: true, pricePerLesson: true } } },
    }),
  ]);
  const balance = Number(balanceAgg._sum.amount ?? 0);

  if (groupLinks.length > 0) {
    const groups: AbonementGroupBreakdown[] = groupLinks.map(({ group }) => {
      const pricePerLesson = Number(group.pricePerLesson);
      return {
        groupId: group.id,
        groupName: group.name,
        pricePerLesson,
        remainingLessons: remainingLessonsFor(balance, pricePerLesson),
      };
    });
    const figures = groups
      .map((g) => g.remainingLessons)
      .filter((n): n is number => n !== null);

    return {
      balance,
      mode: groups.length === 1 ? "SINGLE_GROUP" : "MULTI_GROUP",
      groups,
      individual: null,
      minRemainingLessons: figures.length > 0 ? Math.min(...figures) : null,
    };
  }

  // No group membership: fall back to the student's most recent individual
  // (1-on-1) lesson rate, if any.
  const pricePerLesson = await getLastIndividualLessonPrice(studentId);

  if (pricePerLesson !== null) {
    const remainingLessons = remainingLessonsFor(balance, pricePerLesson);
    return {
      balance,
      mode: "INDIVIDUAL",
      groups: [],
      individual: remainingLessons !== null ? { pricePerLesson, remainingLessons } : null,
      minRemainingLessons: remainingLessons,
    };
  }

  return { balance, mode: "NONE", groups: [], individual: null, minRemainingLessons: null };
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
