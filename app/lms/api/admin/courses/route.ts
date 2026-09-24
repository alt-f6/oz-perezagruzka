import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { parseCourseFacets } from "@/lms/lib/course-facets";

export const runtime = "nodejs";

export const GET = withApiErrors(async () => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  const courses = await db.course.findMany({
    select: { id: true, title: true, isPublished: true, subject: true, examType: true, grade: true },
    orderBy: { title: "asc" },
    take: 200,
  });

  return NextResponse.json({ ok: true, courses });
});

export const POST = withApiErrors(async (req: NextRequest) => {
  const admin = await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });

  const description = body.description ? String(body.description).trim() : "";

  const facets = parseCourseFacets(body);
  if (!facets.ok) return NextResponse.json({ ok: false, error: facets.error }, { status: 400 });

  const course = await db.course.create({
    data: { title, description, teacherId: admin.id, ...facets.data },
    select: { id: true, title: true, isPublished: true, subject: true, examType: true, grade: true },
  });

  return NextResponse.json({ ok: true, course });
});
