import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { buildCursorPage, parsePaginationParams } from "@/shared/lib/pagination";
import { getAccessibleLessons } from "@/lms/server/student/accessible-lessons";

// Lessons the student can open: direct assignments plus lessons of their
// active course enrollments (see getAccessibleLessons). The list is merged
// in memory, so the cursor is the last returned *lesson* id.
export const GET = withApiErrors(async (req: NextRequest) => {
  const user = await requireRole(["STUDENT"], { adminBypass: true });

  const { cursor, limit } = parsePaginationParams(new URL(req.url).searchParams, 500);

  const all = await getAccessibleLessons(user.id);
  // An unknown/stale cursor yields an empty page rather than restarting.
  const start = cursor ? (all.findIndex((l) => l.id === cursor) + 1 || all.length) : 0;
  const { items, nextCursor } = buildCursorPage(all.slice(start, start + limit + 1), limit);

  const lessons = items.map((l) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    order: l.order,
    course_title: l.courseTitle,
    module_title: l.moduleTitle,
    completed_at: l.completedAt ? l.completedAt.toISOString() : null,
  }));

  return NextResponse.json({ ok: true, lessons, nextCursor });
});
