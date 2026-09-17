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
