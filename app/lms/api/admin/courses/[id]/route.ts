import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { parseCourseFacets } from "@/lms/lib/course-facets";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// Roles that may own a course (Course.teacherId). A TEACHER owner is what
// scopes that teacher's LMS catalog to the course.
const OWNER_ROLES = ["TEACHER", "ADMIN", "MANAGER"] as const;

const COURSE_SELECT = {
  id: true,
  title: true,
  isPublished: true,
  subject: true,
  examType: true,
  grade: true,
  teacherId: true,
} satisfies Prisma.CourseSelect;

// Partial update: only the fields present in the body are changed.
export const PATCH = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Prisma.CourseUncheckedUpdateInput = {};

  if ("title" in body) {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });
    data.title = title;
  }

  if ("is_published" in body) data.isPublished = Boolean(body.is_published);

  if ("teacher_id" in body) {
    const teacherId = String(body.teacher_id ?? "").trim();
    const owner = teacherId
      ? await db.user.findUnique({ where: { id: teacherId }, select: { role: true, isArchived: true } })
      : null;
    if (!owner || owner.isArchived || !(OWNER_ROLES as readonly string[]).includes(owner.role)) {
      return NextResponse.json({ ok: false, error: "invalid_teacher" }, { status: 400 });
    }
    data.teacherId = teacherId;
  }

  const facets = parseCourseFacets(body);
  if (!facets.ok) return NextResponse.json({ ok: false, error: facets.error }, { status: 400 });
  Object.assign(data, facets.data);

  const existing = await db.course.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const course = await db.course.update({ where: { id }, data, select: COURSE_SELECT });
  return NextResponse.json({ ok: true, course });
});
