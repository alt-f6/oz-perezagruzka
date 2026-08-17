import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRoleApi } from "@/lms/server/auth/require-role-api";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { canViewLesson } from "@/lms/server/access/can-view-lesson";
import type { Role } from "@/shared/lib/auth";

function parseLessonId(raw: string | null) {
  if (!raw) return null;
  return raw;
}

async function hasStudentAccess(studentId: string, role: Role, lessonId: string) {
  return canViewLesson({ userId: studentId, role, lessonId });
}

export const GET = withApiErrors(async (req: NextRequest) => {
  const session = await requireRoleApi("STUDENT");

  const { searchParams } = new URL(req.url);
  const lessonId = parseLessonId(searchParams.get("lessonId"));
  if (!lessonId) {
    return NextResponse.json({ ok: false, error: "lessonId_required" }, { status: 400 });
  }

  const allowed = await hasStudentAccess(session.id, session.role, lessonId);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const rows = await db.lessonMessage.findMany({
    where: { lessonId, studentId: session.id },
    orderBy: { createdAt: "asc" },
    include: { lesson: { select: { title: true } } },
    take: 500,
  });

  const messages = rows.map((m) => ({
    id: m.id,
    text: m.text,
    sender_role: m.senderRole,
    created_at: m.createdAt,
    lesson_title: m.lesson.title,
  }));

  return NextResponse.json({
    ok: true,
    messages,
  });
});

export const POST = withApiErrors(async (req: NextRequest) => {
  const session = await requireRoleApi("STUDENT");

  const body = await req.json().catch(() => null);
  const { lessonId, text } = body ?? {};

  const parsedLessonId = parseLessonId(
    lessonId === undefined || lessonId === null ? null : String(lessonId)
  );

  if (!parsedLessonId || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const allowed = await hasStudentAccess(session.id, session.role, parsedLessonId);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  await db.lessonMessage.create({
    data: {
      lessonId: parsedLessonId,
      studentId: session.id,
      text: text.trim(),
      senderRole: session.role,
    },
  });

  return NextResponse.json({ ok: true });
});
