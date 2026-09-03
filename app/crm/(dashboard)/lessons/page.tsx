import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { listLessons } from "@/crm/lib/services/lesson-list.service";
import { LessonsClient } from "./LessonsClient";

export default async function LessonsPage() {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);
  const isTeacher = sessionUser.role === "TEACHER";

  const [{ lessons, nextCursor }, groups, teachers, students] = await Promise.all([
    listLessons({ sessionUser }),
    db.group.findMany({
      where: isTeacher ? { teacherId: sessionUser.id } : undefined,
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, teacherId: true },
    }),
    db.user.findMany({
      where: isTeacher
        ? { role: "TEACHER", id: sessionUser.id }
        : { role: "TEACHER" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    // Individual-lesson picker source; not needed for the teacher read-only view.
    isTeacher
      ? Promise.resolve([])
      : db.student.findMany({
          where: { deletedAt: null },
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true },
        }),
  ]);

  return (
    <LessonsClient
      initialLessons={lessons}
      initialNextCursor={nextCursor}
      groups={groups}
      teachers={teachers}
      students={students}
      userRole={sessionUser.role}
    />
  );
}
