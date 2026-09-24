import { isExamType, isSubject, type ExamType, type Subject } from "@/shared/lib/education";

// URL-synced filters for /admin/lessons (?q=&exam=&subject=&status=&course=).
// Unknown values are dropped rather than erroring, so a stale/bookmarked URL
// degrades to "show everything" instead of an empty page.

export const LESSON_STATUS_FILTERS = ["published", "draft", "empty"] as const;

export type LessonStatusFilter = (typeof LESSON_STATUS_FILTERS)[number];

export type LessonFilters = {
  q: string | null;
  exam: ExamType | null;
  subject: Subject | null;
  status: LessonStatusFilter | null;
  course: string | null;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : null;
}

export function parseLessonFilters(params: RawParams): LessonFilters {
  const q = first(params.q);
  const exam = first(params.exam)?.toUpperCase() ?? null;
  const subject = first(params.subject);
  const status = first(params.status);
  const course = first(params.course);

  return {
    q: q ? q.slice(0, 100) : null,
    exam: isExamType(exam) ? exam : null,
    subject: isSubject(subject) ? subject : null,
    status: (LESSON_STATUS_FILTERS as readonly string[]).includes(status ?? "")
      ? (status as LessonStatusFilter)
      : null,
    course,
  };
}

/** Builds a query string from filters, omitting empty values. */
export function lessonFiltersToQuery(filters: Partial<LessonFilters>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function hasActiveLessonFilters(filters: LessonFilters): boolean {
  return Object.values(filters).some(Boolean);
}
