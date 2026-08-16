import { NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { getSessionUser } from "@/lms/server/auth/session";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const GET = withApiErrors(async () => {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  if (session.role !== "ADMIN" && session.role !== "MANAGER") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const rows = await db.lessonMessage.findMany({
    take: 200,
    orderBy: { createdAt: "desc" },
    include: {
      lesson: { select: { title: true } },
      student: { select: { email: true } },
    },
  });

  const messages = rows.map((m) => ({
    id: m.id,
    lesson_id: m.lessonId,
    student_id: m.studentId,
    text: m.text,
    sender_role: m.senderRole,
    created_at: m.createdAt,
    lesson_title: m.lesson?.title ?? null,
    student_email: m.student?.email ?? null,
  }));

  return NextResponse.json({ ok: true, messages });
});
