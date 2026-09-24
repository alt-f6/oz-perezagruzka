import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { parseAccessThrough } from "@/lms/lib/enrollment-access";
import { enrollStudents, getCourseModuleCount, resolveGroupSnapshot } from "@/lms/server/repos/enrollments";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Snapshot-enroll a CRM group: { group_id, access_through_module, dry_run }.
// dry_run returns who would be enrolled / is already in / has no LMS account.
// Future group membership changes do NOT touch enrollments made here.
export const POST = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN"], { adminBypass: true });
  const { id: courseId } = await ctx.params;

  const moduleCount = await getCourseModuleCount(courseId);
  if (moduleCount === null) return NextResponse.json({ ok: false, error: "course_not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const groupId = String(body?.group_id ?? "").trim();
  if (!groupId) return NextResponse.json({ ok: false, error: "group_required" }, { status: 400 });

  const access = parseAccessThrough(body?.access_through_module ?? null, moduleCount);
  if (!access.ok) return NextResponse.json({ ok: false, error: "invalid_access" }, { status: 400 });

  const snapshot = await resolveGroupSnapshot(groupId, courseId);
  if (!snapshot) return NextResponse.json({ ok: false, error: "group_not_found" }, { status: 404 });

  const preview = {
    group: snapshot.group,
    to_enroll: snapshot.toEnroll,
    already_enrolled: snapshot.alreadyEnrolled,
    without_account: snapshot.withoutAccount,
  };

  if (body?.dry_run) return NextResponse.json({ ok: true, dry_run: true, ...preview });

  // Already-enrolled members are included so the group's access level can
  // widen (never narrow) theirs; their original source is kept.
  const result = await enrollStudents({
    courseId,
    studentIds: [...snapshot.toEnroll, ...snapshot.alreadyEnrolled].map((s) => s.userId),
    accessThrough: access.value,
    sourceGroupId: snapshot.group.id,
  });

  return NextResponse.json({ ok: true, dry_run: false, ...preview, ...result });
});
