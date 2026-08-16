import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireRoleApi } from "@/lms/server/auth/require-role-api";
import {
  listStudents,
  listLessons,
  listAssignmentsForStudent,
  grantLesson,
  revokeLesson,
  setAssignmentsForStudent,
} from "@/lms/server/repos/assignments.repo";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

async function requireSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");

  if (!origin || !host) return false;

  try {
    const u = new URL(origin);
    return u.host === host;
  } catch {
    return false;
  }
}

export const GET = withApiErrors(async (req: NextRequest) => {
  await requireRoleApi("ADMIN");

  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");

  const students = await listStudents();
  const lessons = await listLessons();

  if (!studentId) {
    return NextResponse.json({ ok: true, students, lessons, assignedLessonIds: [] });
  }

  const assignedLessonIds = await listAssignmentsForStudent(studentId);

  return NextResponse.json({ ok: true, students, lessons, assignedLessonIds });
});

export const POST = withApiErrors(async (req: NextRequest) => {
  await requireRoleApi("ADMIN");

  if (!(await requireSameOrigin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as any));
  const action = String((body as any).action || "");
  const studentId = String((body as any).studentId || "");

  if (!studentId) {
    return NextResponse.json({ ok: false, error: "studentId required" }, { status: 400 });
  }

  if (action === "set") {
    const lessonIdsRaw = (body as any).lessonIds;

    if (!Array.isArray(lessonIdsRaw)) {
      return NextResponse.json({ ok: false, error: "lessonIds must be array" }, { status: 400 });
    }

    const lessonIds = lessonIdsRaw
      .map((x: any) => String(x))
      .filter((x: string) => x.length > 0);

    await setAssignmentsForStudent(studentId, lessonIds);
    return NextResponse.json({ ok: true });
  }

  if (action === "grant" || action === "revoke") {
    const lessonId = String((body as any).lessonId || "");

    if (!lessonId) {
      return NextResponse.json({ ok: false, error: "lessonId required" }, { status: 400 });
    }

    if (action === "grant") {
      await grantLesson(studentId, lessonId);
      return NextResponse.json({ ok: true });
    }

    await revokeLesson(studentId, lessonId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, error: "action must be grant, revoke, or set" },
    { status: 400 }
  );
});
