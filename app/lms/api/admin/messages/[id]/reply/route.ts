import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { enforceRateLimit } from "@/lms/server/http/rate-limit";

export const POST = withApiErrors(async (
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const session = await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  await enforceRateLimit(`lms:admin-messages-reply:${session.id}`, 20, 60_000);

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const text = body?.text;

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const parent = await db.lessonMessage.findUnique({ where: { id } });

  if (!parent) {
    return NextResponse.json({ ok: false, error: "message_not_found" }, { status: 404 });
  }

  await db.lessonMessage.create({
    data: {
      lessonId: parent.lessonId,
      studentId: parent.studentId,
      text: text.trim(),
      senderRole: session.role,
    },
  });

  return NextResponse.json({ ok: true });
});
