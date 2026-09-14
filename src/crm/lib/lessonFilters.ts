import { lessonListFiltersSchema, type LessonListFilters } from "@/crm/lib/schemas";
import {
  addMoscowDays,
  moscowStartOfDay,
  moscowStartOfNextDay,
  moscowStartOfNextWeek,
  moscowStartOfWeek,
} from "@/shared/lib/timezone";

/**
 * Parses raw Next.js searchParams (or any plain query object, array values
 * included) into typed, defaulted lesson list filters. Every field falls
 * back to a safe default rather than throwing -- see the `.catch()` clauses
 * on `lessonListFiltersSchema` -- so a malformed/stale URL never 500s the page.
 */
export function parseLessonListFilters(raw: Record<string, string | string[] | undefined>): LessonListFilters {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  return lessonListFiltersSchema.parse(flat);
}

export interface LessonDateWindow {
  gte?: Date;
  lt?: Date;
  orderDirection: "asc" | "desc";
}

/**
 * Resolves the [gte, lt) `scheduledAt` window and sort direction for a set of
 * filters, anchored to Europe/Moscow wall-clock boundaries. Precedence (first
 * match wins):
 *
 *  1. An explicit custom range (`from`/`to`) always wins over any preset or
 *     status -- the operator picked exact dates on purpose.
 *  2. A date preset (TODAY/TOMORROW/THIS_WEEK) narrows to that MSK day/week.
 *  3. A history-oriented status (COMPLETED/CANCELLED) with no preset/custom
 *     range shows full history, most recent first (desc).
 *  4. NEEDS_ATTENTION (a status, not a preset) is inherently about concluded
 *     lessons -- no lower bound, upper-bounded at `now`, oldest-first (asc)
 *     so the longest-overdue journal gaps surface first.
 *  5. Default: only upcoming lessons from today onward, ascending -- the
 *     "immediate operational relevance" ordering the spec calls for.
 */
export function resolveLessonDateWindow(
  filters: Pick<LessonListFilters, "range" | "status" | "from" | "to">,
  now: Date = new Date(),
): LessonDateWindow {
  if (filters.from || filters.to) {
    return {
      gte: filters.from ? moscowStartOfDay(filters.from) : undefined,
      lt: filters.to ? moscowStartOfNextDay(filters.to) : undefined,
      orderDirection: "asc",
    };
  }

  if (filters.range === "TODAY") {
    return { gte: moscowStartOfDay(now), lt: moscowStartOfNextDay(now), orderDirection: "asc" };
  }
  if (filters.range === "TOMORROW") {
    const tomorrow = addMoscowDays(now, 1);
    return { gte: moscowStartOfDay(tomorrow), lt: moscowStartOfNextDay(tomorrow), orderDirection: "asc" };
  }
  if (filters.range === "THIS_WEEK") {
    return { gte: moscowStartOfWeek(now), lt: moscowStartOfNextWeek(now), orderDirection: "asc" };
  }

  if (filters.status === "COMPLETED" || filters.status === "CANCELLED") {
    return { orderDirection: "desc" };
  }

  if (filters.status === "NEEDS_ATTENTION") {
    return { lt: now, orderDirection: "asc" };
  }

  return { gte: moscowStartOfDay(now), orderDirection: "asc" };
}

export type AttendanceCardinalityStatus = "SCHEDULED" | "CANCELLED" | "UNMARKED" | "PARTIALLY_MARKED" | "COMPLETED";

/**
 * Cardinality-aware classification of a single lesson's attendance state.
 * `concluded` must be the precise scheduledEnd<=now check (see
 * isLessonConcluded in lessonTime.ts) -- a lesson still in progress is never
 * classified as needing attendance yet, no matter how many students are
 * already marked.
 */
export function classifyLessonAttendance(input: {
  sessionStatus: string;
  concluded: boolean;
  enrolledCount: number;
  markedCount: number;
}): AttendanceCardinalityStatus {
  if (input.sessionStatus === "cancelled") return "CANCELLED";
  if (!input.concluded) return "SCHEDULED";
  if (input.enrolledCount === 0) return "COMPLETED";
  if (input.markedCount === 0) return "UNMARKED";
  if (input.markedCount < input.enrolledCount) return "PARTIALLY_MARKED";
  return "COMPLETED";
}

export function needsAttention(status: AttendanceCardinalityStatus): boolean {
  return status === "UNMARKED" || status === "PARTIALLY_MARKED";
}

// Query keys that always reset pagination to page 1 when changed -- this is
// what prevents the "zero-result pagination trap": a narrower filter leaving
// `page` pointed past the new, shorter result set.
const PAGE_RESET_KEYS = ["q", "teacherId", "format", "status", "range", "from", "to", "pageSize"] as const;

/**
 * Merges a partial filter change into the current URL query, clearing keys
 * patched with null/undefined/"" and resetting `page` to "1" whenever any
 * non-page filter changes. Pure and DOM-free so it's directly unit-testable;
 * the client component adapts plain `URLSearchParams` to/from the Record this
 * operates on.
 */
export function buildLessonsQuery(
  current: Record<string, string>,
  patch: Record<string, string | null | undefined>,
): Record<string, string> {
  const next = { ...current };
  let resetPage = false;

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    if ((PAGE_RESET_KEYS as readonly string[]).includes(key)) {
      resetPage = true;
    }
  }

  if (resetPage) {
    next.page = "1";
  }

  return next;
}
