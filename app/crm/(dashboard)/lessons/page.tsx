import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { listLessons } from "@/crm/lib/services/lesson-list.service";
import { LessonsClient } from "./LessonsClient";

export default async function LessonsPage() {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);
  const isTeacher = sessionUser.role === "TEACHER";

  const [{ lessons, nextCursor }, groups] = await Promise.all([
    listLessons({ sessionUser }),
    db.group.findMany({
      where: isTeacher ? { teacherId: sessionUser.id } : undefined,
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, teacherId: true },
    }),
  ]);

  return (
    <LessonsClient
      initialLessons={lessons}
      initialNextCursor={nextCursor}
      groups={groups}
      userRole={sessionUser.role}
    />
  );
}
