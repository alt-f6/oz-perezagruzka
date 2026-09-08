import { BUSINESS_TIMEZONE_LABEL } from "@/shared/lib/timezone";

/**
 * Fixed, non-interactive label confirming which timezone the schedule/lesson
 * times shown around it belong to. Not a per-user timezone selector — the
 * product always displays Moscow wall-clock (see BUSINESS_TIMEZONE); this is
 * purely a visual reminder for operators in a different timezone.
 */
export function TimezoneBadge() {
  return (
    <span
      className="badge-neutral"
      title="Все время указано по часовому поясу школы"
    >
      {BUSINESS_TIMEZONE_LABEL}
    </span>
  );
}
