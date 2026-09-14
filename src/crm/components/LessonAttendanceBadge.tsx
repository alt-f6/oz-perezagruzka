import { Badge } from "@/shared/components/ui/badge";
import type { AttendanceCardinalityStatus } from "@/crm/lib/lessonFilters";

export function LessonAttendanceBadge({
  status,
  enrolledCount,
  markedCount,
}: {
  status: AttendanceCardinalityStatus;
  enrolledCount: number;
  markedCount: number;
}) {
  switch (status) {
    case "SCHEDULED":
      return <Badge variant="outline">Запланировано</Badge>;
    case "CANCELLED":
      return <Badge variant="secondary">Отменено</Badge>;
    case "UNMARKED":
      return (
        <Badge variant="destructive" className="animate-pulse">
          Не отмечено
        </Badge>
      );
    case "PARTIALLY_MARKED":
      return (
        <Badge variant="destructive" className="animate-pulse">
          Частично: {markedCount}/{enrolledCount}
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge variant="success">
          {markedCount}/{enrolledCount} отмечено
        </Badge>
      );
  }
}
