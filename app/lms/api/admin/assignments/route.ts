import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireRole } from "@/shared/lib/rbac";
import {
  listStudents,
  listLessons,
  listAssignmentsForStudent,
  listAssignedStudentIdsForLesson,
  grantLesson,
  revokeLesson,
  setAssignmentsForStudent,
  setAssignmentsForLesson,
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
  await requireRole(["ADMIN"], { adminBypass: true });

  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");
  const lessonId = url.searchParams.get("lessonId");

  const students = await listStudents();
  const lessons = await listLessons();

  if (lessonId) {
    const assignedStudentIds = await listAssignedStudentIdsForLesson(lessonId);
    return NextResponse.json({ ok: true, students, lessons, assignedLessonIds: [], assignedStudentIds });
  }

  if (!studentId) {
    return NextResponse.json({ ok: true, students, lessons, assignedLessonIds: [], assignedStudentIds: [] });
  }

  const assignedLessonIds = await listAssignmentsForStudent(studentId);

  return NextResponse.json({ ok: true, students, lessons, assignedLessonIds, assignedStudentIds: [] });
});

export const POST = withApiErrors(async (req: NextRequest) => {
  await requireRole(["ADMIN"], { adminBypass: true });

  if (!(await requireSameOrigin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "setForLesson") {
    const lessonId = String(body.lessonId ?? "");
    const studentIdsRaw = body.studentIds;

    if (!lessonId) {
      return NextResponse.json({ ok: false, error: "lessonId required" }, { status: 400 });
    }

    if (!Array.isArray(studentIdsRaw)) {
      return NextResponse.json({ ok: false, error: "studentIds must be array" }, { status: 400 });
    }

    const studentIds = studentIdsRaw.map((x: unknown) => String(x)).filter((x: string) => x.length > 0);

    await setAssignmentsForLesson(lessonId, studentIds);
    return NextResponse.json({ ok: true });
  }

  const studentId = String(body.studentId ?? "");

  if (!studentId) {
    return NextResponse.json({ ok: false, error: "studentId required" }, { status: 400 });
  }

  if (action === "set") {
    const lessonIdsRaw = body.lessonIds;

    if (!Array.isArray(lessonIdsRaw)) {
      return NextResponse.json({ ok: false, error: "lessonIds must be array" }, { status: 400 });
    }

    const lessonIds = lessonIdsRaw
      .map((x: unknown) => String(x))
      .filter((x: string) => x.length > 0);

    await setAssignmentsForStudent(studentId, lessonIds);
    return NextResponse.json({ ok: true });
  }

  if (action === "grant" || action === "revoke") {
    const lessonId = String(body.lessonId ?? "");

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
    { ok: false, error: "action must be grant, revoke, set, or setForLesson" },
    { status: 400 }
  );
});
