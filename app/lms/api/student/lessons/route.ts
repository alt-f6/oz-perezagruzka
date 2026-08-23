import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/shared/lib/rbac";
import { db } from "@/shared/lib/db";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { buildCursorPage, parsePaginationParams } from "@/shared/lib/pagination";

export const GET = withApiErrors(async (req: NextRequest) => {
  const user = await requireRole(["STUDENT"], { adminBypass: true });

  const { cursor, limit } = parsePaginationParams(new URL(req.url).searchParams, 500);

  const rows = await db.assignment.findMany({
    where: { studentId: user.id, lesson: { isPublished: true } },
    include: { lesson: { include: { progress: { where: { studentId: user.id } } } } },
    orderBy: [{ lesson: { order: "asc" } }, { lesson: { id: "asc" } }, { id: "asc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const { items, nextCursor } = buildCursorPage(rows, limit);

  const lessons = items.map((a) => ({
    id: a.lesson.id,
    title: a.lesson.title,
    description: a.lesson.description,
    order: a.lesson.order,
    completed_at: a.lesson.progress[0]?.completedAt ? a.lesson.progress[0].completedAt.toISOString() : null,
  }));

  return NextResponse.json({ ok: true, lessons, nextCursor });
});
