import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { enforceRateLimit } from "@/lms/server/http/rate-limit";
import { buildCursorPage, parsePaginationParams } from "@/shared/lib/pagination";

export const GET = withApiErrors(async (req: NextRequest) => {
  const admin = await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  await enforceRateLimit(`lms:admin-messages-list:${admin.id}`, 60, 60_000);

  const { cursor, limit } = parsePaginationParams(new URL(req.url).searchParams);

  const rows = await db.lessonMessage.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      lesson: { select: { title: true } },
      student: { select: { email: true } },
    },
  });

  const { items, nextCursor } = buildCursorPage(rows, limit);

  const messages = items.map((m) => ({
    id: m.id,
    lesson_id: m.lessonId,
    student_id: m.studentId,
    text: m.text,
    sender_role: m.senderRole,
    created_at: m.createdAt,
    lesson_title: m.lesson?.title ?? null,
    student_email: m.student?.email ?? null,
  }));

  return NextResponse.json({ ok: true, messages, nextCursor });
});
