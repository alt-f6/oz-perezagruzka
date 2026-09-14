import { NextRequest, NextResponse } from "next/server";
import { requireRole, rbacErrorResponse } from "@/shared/lib/rbac";
import { CRM_ROLES } from "@/shared/lib/auth";
import { parseLessonListFilters } from "@/crm/lib/lessonFilters";
import { listLessonsPage } from "@/crm/lib/services/lesson-list.service";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  let sessionUser;
  try {
    sessionUser = await requireRole(CRM_ROLES);
  } catch (err) {
    return rbacErrorResponse(err);
  }

  const url = new URL(req.url);
  const parsed = parseLessonListFilters(Object.fromEntries(url.searchParams.entries()));
  // Defense-in-depth: listLessonsPage's own where-builder already ignores
  // teacherId for a TEACHER, but clearing it here keeps the RBAC boundary
  // visible at this entry point too.
  const filters = sessionUser.role === "TEACHER" ? { ...parsed, teacherId: undefined } : parsed;

  const result = await listLessonsPage({ sessionUser, filters });

  return NextResponse.json({ ok: true, ...result });
}
