import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const MAX_TEACHERS = 50;

// Replaces the course's explicit teacher links (CourseTeacher) with exactly
// `teacher_ids`. Only active TEACHER users can be linked; the owner
// (Course.teacherId) is managed separately via PATCH /api/admin/courses/[id].
export const PUT = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });
  const { id: courseId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { teacher_ids?: unknown };
  if (!Array.isArray(body.teacher_ids) || !body.teacher_ids.every((t) => typeof t === "string")) {
    return NextResponse.json({ ok: false, error: "teacher_ids_required" }, { status: 400 });
  }
  const teacherIds = [...new Set(body.teacher_ids as string[])];
  if (teacherIds.length > MAX_TEACHERS) {
    return NextResponse.json({ ok: false, error: "too_many_teachers" }, { status: 400 });
  }

  const course = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const validCount = await db.user.count({
    where: { id: { in: teacherIds }, role: "TEACHER", isArchived: false },
  });
  if (validCount !== teacherIds.length) {
    return NextResponse.json({ ok: false, error: "invalid_teacher" }, { status: 400 });
  }

  await db.$transaction([
    db.courseTeacher.deleteMany({ where: { courseId, teacherId: { notIn: teacherIds } } }),
    db.courseTeacher.createMany({
      data: teacherIds.map((teacherId) => ({ courseId, teacherId })),
      skipDuplicates: true,
    }),
  ]);

  return NextResponse.json({ ok: true, teacher_ids: teacherIds });
});
