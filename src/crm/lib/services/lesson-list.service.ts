import { db } from "@/shared/lib/db";
import { buildCursorPage } from "@/shared/lib/pagination";
import type { ClassSessionWithGroup } from "@/crm/lib/types";

export interface ListLessonsOpts {
  sessionUser: { id: string; role: string };
  cursor?: string;
  limit?: number;
}

export async function listLessons(
  opts: ListLessonsOpts,
): Promise<{ lessons: ClassSessionWithGroup[]; nextCursor: string | null }> {
  const { sessionUser } = opts;
  const isTeacher = sessionUser.role === "TEACHER";
  const limit = opts.limit ?? 50;

  const rows = await db.classSession.findMany({
    where: isTeacher ? { teacherId: sessionUser.id } : undefined,
    orderBy: { scheduledAt: "desc" },
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      groupId: true,
      scheduledAt: true,
      status: true,
      durationMinutes: true,
      recurrenceGroupId: true,
      group: { select: { id: true, name: true, teacherId: true } },
    },
  });

  const { items, nextCursor } = buildCursorPage(rows, limit);

  return { lessons: items as unknown as ClassSessionWithGroup[], nextCursor };
}
