import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import type { ClassSessionWithGroup } from "@/crm/lib/types";
import { LessonsClient } from "./LessonsClient";

export default async function LessonsPage() {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);
  const isTeacher = sessionUser.role === "TEACHER";

  const [lessons, groups] = await Promise.all([
    db.classSession.findMany({
      where: isTeacher ? { teacherId: sessionUser.id } : undefined,
      orderBy: { scheduledAt: "desc" },
      take: 1000,
      select: {
        id: true,
        groupId: true,
        scheduledAt: true,
        status: true,
        durationMinutes: true,
        recurrenceGroupId: true,
        group: { select: { id: true, name: true, teacherId: true } },
      },
    }),
    db.group.findMany({
      where: isTeacher ? { teacherId: sessionUser.id } : undefined,
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, teacherId: true },
    }),
  ]);

  return (
    <LessonsClient
      lessons={lessons as unknown as ClassSessionWithGroup[]}
      groups={groups}
      userRole={sessionUser.role}
    />
  );
}
