import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { advanceAccess } from "@/lms/lib/enrollment-access";
import { getCourseModuleCount } from "@/lms/server/repos/enrollments";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const ACTIONS = ["advance", "full", "suspend", "activate", "remove"] as const;
type BulkAction = (typeof ACTIONS)[number];

// Roster multi-select: { ids: enrollmentIds, action }.
//   advance  -> "+1 месяц" (whole-course enrollments are left as is)
//   full     -> whole course
//   suspend / activate -> status
//   remove   -> delete the enrollment (LessonProgress is kept)
export const POST = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN"], { adminBypass: true });
  const { id: courseId } = await ctx.params;

  const moduleCount = await getCourseModuleCount(courseId);
  if (moduleCount === null) return NextResponse.json({ ok: false, error: "course_not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "") as BulkAction;
  const ids: string[] = Array.isArray(body?.ids)
    ? [...new Set<string>(body.ids.map((x: unknown) => String(x).trim()).filter(Boolean))]
    : [];

  if (!ACTIONS.includes(action)) return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  if (ids.length === 0 || ids.length > 500) return NextResponse.json({ ok: false, error: "invalid_ids" }, { status: 400 });

  // Always scoped to this course, so ids from another course are ignored.
  const where = { id: { in: ids }, courseId };

  if (action === "remove") {
    const r = await db.enrollment.deleteMany({ where });
    return NextResponse.json({ ok: true, updated: r.count });
  }
  if (action === "suspend" || action === "activate") {
    const r = await db.enrollment.updateMany({
      where,
      data: action === "suspend" ? { status: "SUSPENDED" } : { status: "ACTIVE", completedAt: null },
    });
    return NextResponse.json({ ok: true, updated: r.count });
  }
  if (action === "full") {
    const r = await db.enrollment.updateMany({ where, data: { accessThroughModule: null } });
    return NextResponse.json({ ok: true, updated: r.count });
  }

  const rows = await db.enrollment.findMany({ where, select: { id: true, accessThroughModule: true } });
  let updated = 0;
  await db.$transaction(async (tx) => {
    for (const row of rows) {
      const next = advanceAccess(row.accessThroughModule, moduleCount);
      if (next === row.accessThroughModule) continue;
      await tx.enrollment.update({ where: { id: row.id }, data: { accessThroughModule: next } });
      updated += 1;
    }
  });
  return NextResponse.json({ ok: true, updated });
});
