import { db } from "@/shared/lib/db";
import { createLogger } from "@/shared/lib/logger";
import type {
  ScheduleGroup,
  ScheduleLesson,
  ScheduleStudent,
  ScheduleTeacher,
} from "./ScheduleClient";

const logger = createLogger("crm.schedule");

export interface ScheduleData {
  lessons: ScheduleLesson[];
  groups: ScheduleGroup[];
  teachers: ScheduleTeacher[];
  students: ScheduleStudent[];
}

export type ScheduleLoadResult =
  | { ok: true; data: ScheduleData }
  | { ok: false; error: string };

/**
 * Loads everything the schedule calendar needs, wrapped so that ANY data-layer
 * failure (query timeout, missing relation, null teacher/group field) resolves
 * to a graceful `{ ok: false }` instead of throwing.
 *
 * Why this exists (INVARIANT: fail-safe data fetching): a thrown error here
 * would bubble to the dashboard error boundary — and more importantly, the
 * intermittent-logout report traces to session-guard nulls, never to a caught
 * data error. Keeping data errors OUT of the throw path guarantees a calendar
 * loading problem renders a local error state and can never be mistaken for an
 * auth failure or destroy the active session. It is intentionally free of any
 * redirect/auth logic.
 */
export async function loadScheduleData(sessionUser: {
  id: string;
  role: string;
}): Promise<ScheduleLoadResult> {
  const isTeacher = sessionUser.role === "TEACHER";

  try {
    const [lessons, groups, teachers, students] = await Promise.all([
      db.classSession.findMany({
        where: isTeacher ? { teacherId: sessionUser.id } : undefined,
        orderBy: { scheduledAt: "asc" },
        take: 1000,
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          groupId: true,
          studentId: true,
          teacherId: true,
          status: true,
          durationMinutes: true,
          group: { select: { id: true, name: true } },
          student: { select: { id: true, fullName: true } },
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
      // Students power the individual-lesson picker. Teachers can't create
      // lessons, so the list is only needed for ADMIN/MANAGER.
      isTeacher
        ? Promise.resolve([])
        : db.student.findMany({
            where: { deletedAt: null },
            orderBy: { fullName: "asc" },
            select: { id: true, fullName: true },
          }),
    ]);

    return {
      ok: true,
      data: {
        lessons: lessons as unknown as ScheduleLesson[],
        groups: groups as ScheduleGroup[],
        teachers: teachers as ScheduleTeacher[],
        students: students as ScheduleStudent[],
      },
    };
  } catch (err) {
    logger.error("Failed to load schedule data", err);
    return {
      ok: false,
      error: "Не удалось загрузить расписание. Попробуйте обновить страницу.",
    };
  }
}
