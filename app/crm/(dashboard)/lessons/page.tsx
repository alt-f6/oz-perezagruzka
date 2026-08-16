import { db } from "@/shared/lib/db";
import { requireSessionUser } from "@/shared/lib/auth";
import type { ClassSessionWithGroup } from "@/crm/lib/types";
import { LessonsClient } from "./LessonsClient";

export default async function LessonsPage() {
  const sessionUser = await requireSessionUser(["ADMIN", "MANAGER", "TEACHER"]);
  const isTeacher = sessionUser.role === "TEACHER";

  const [lessons, groups] = await Promise.all([
    db.classSession.findMany({
      where: isTeacher ? { teacherId: sessionUser.id } : undefined,
      orderBy: { scheduledAt: "desc" },
      select: {
        id: true,
        groupId: true,
        scheduledAt: true,
        status: true,
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
    />
  );
}
