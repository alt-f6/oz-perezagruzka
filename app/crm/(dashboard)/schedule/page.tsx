import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import {
  ScheduleClient,
  type ScheduleGroup,
  type ScheduleLesson,
  type ScheduleTeacher,
} from "./ScheduleClient";

export default async function SchedulePage() {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);
  const isTeacher = sessionUser.role === "TEACHER";

  const [lessons, groups, teachers] = await Promise.all([
    db.classSession.findMany({
      where: isTeacher ? { teacherId: sessionUser.id } : undefined,
      orderBy: { scheduledAt: "asc" },
      take: 1000,
      select: {
        id: true,
        scheduledAt: true,
        groupId: true,
        teacherId: true,
        status: true,
        durationMinutes: true,
        group: { select: { id: true, name: true } },
      },
    }),
    db.group.findMany({
      where: isTeacher ? { teacherId: sessionUser.id } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true, teacherId: true },
    }),
    db.user.findMany({
      where: isTeacher
        ? { role: "TEACHER", id: sessionUser.id }
        : { role: "TEACHER" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  return (
    <ScheduleClient
      lessons={lessons as unknown as ScheduleLesson[]}
      groups={groups as ScheduleGroup[]}
      teachers={teachers as ScheduleTeacher[]}
      userRole={sessionUser.role}
    />
  );
}
