import { NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { enforceRateLimit } from "@/lms/server/http/rate-limit";

export const GET = withApiErrors(async () => {
  const admin = await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  await enforceRateLimit(`lms:admin-messages-list:${admin.id}`, 60, 60_000);

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
