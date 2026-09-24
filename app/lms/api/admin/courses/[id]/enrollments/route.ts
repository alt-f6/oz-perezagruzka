import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { parseAccessThrough } from "@/lms/lib/enrollment-access";
import { enrollStudents, filterStudentUserIds, getCourseModuleCount } from "@/lms/server/repos/enrollments";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const MAX_IDS = 500;

// Enroll individual LMS students: { student_ids, access_through_module }.
// access_through_module: null/"all" = whole course, N = first N modules.
export const POST = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN"], { adminBypass: true });
  const { id: courseId } = await ctx.params;

  const moduleCount = await getCourseModuleCount(courseId);
  if (moduleCount === null) return NextResponse.json({ ok: false, error: "course_not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const requested: string[] = Array.isArray(body?.student_ids)
    ? [...new Set<string>(body.student_ids.map((x: unknown) => String(x).trim()).filter(Boolean))]
    : [];
  if (requested.length === 0 || requested.length > MAX_IDS) {
    return NextResponse.json({ ok: false, error: "invalid_student_ids" }, { status: 400 });
  }

  const access = parseAccessThrough(body?.access_through_module ?? null, moduleCount);
  if (!access.ok) return NextResponse.json({ ok: false, error: "invalid_access" }, { status: 400 });

  const studentIds = await filterStudentUserIds(requested);
  if (studentIds.length !== requested.length) {
    return NextResponse.json({ ok: false, error: "not_students" }, { status: 400 });
  }

  const result = await enrollStudents({ courseId, studentIds, accessThrough: access.value });
  return NextResponse.json({ ok: true, ...result });
});
