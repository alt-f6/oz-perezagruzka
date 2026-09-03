import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { AvailabilityGrid, type AvailabilityTeacher } from "../AvailabilityGrid";

export default async function AvailabilityPage() {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);
  const isTeacher = sessionUser.role === "TEACHER";

  // Teachers manage only their own grid; ADMIN/MANAGER pick from the roster.
  const teachers = (await db.user.findMany({
    where: isTeacher
      ? { role: "TEACHER", id: sessionUser.id }
      : { role: "TEACHER", isArchived: false },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  })) as AvailabilityTeacher[];

  const initialTeacherId = isTeacher
    ? sessionUser.id
    : (teachers[0]?.id ?? "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/schedule"
          className="flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft size={15} /> К расписанию
        </Link>
        <div>
          <h1 className="page-title">Доступность преподавателей</h1>
          <p className="page-subtitle">
            Рабочие окна по дням недели, 07:00–22:00 МСК
          </p>
        </div>
      </div>

      {teachers.length === 0 ? (
        <div className="empty-state bg-white">Нет преподавателей</div>
      ) : (
        <AvailabilityGrid
          teachers={teachers}
          initialTeacherId={initialTeacherId}
          canChooseTeacher={!isTeacher}
        />
      )}
    </div>
  );
}
