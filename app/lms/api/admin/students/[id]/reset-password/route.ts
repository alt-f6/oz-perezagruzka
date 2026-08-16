import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRoleApi } from "@/lms/server/auth/require-role-api";
import { hashPassword } from "@/shared/lib/auth";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function readId({ params }: Ctx) {
  const { id } = await params;
  if (!id) return null;
  return id;
}

function validatePassword(pw: string) {
  if (pw.length < 8) return "password_too_short";
  if (pw.length > 200) return "password_too_long";
  return null;
}

export const POST = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireRoleApi("ADMIN");
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const id = await readId(ctx);
  if (!id) return NextResponse.json({ ok: false, error: "bad_id" }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));
  const newPassword = String((body as any).newPassword || "");
  const confirmPassword = String((body as any).confirmPassword || "");

  if (!newPassword) {
    return NextResponse.json({ ok: false, error: "new_password_required" }, { status: 400 });
  }
  if (confirmPassword && confirmPassword !== newPassword) {
    return NextResponse.json({ ok: false, error: "password_mismatch" }, { status: 400 });
  }

  const v = validatePassword(newPassword);
  if (v) return NextResponse.json({ ok: false, error: v }, { status: 400 });

  const u = await db.user.findUnique({ where: { id } });
  if (!u) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (u.role !== "STUDENT") return NextResponse.json({ ok: false, error: "not_student" }, { status: 400 });

  const passwordHash = await hashPassword(newPassword);

  await db.user.update({ where: { id }, data: { passwordHash } });

  await db.session.deleteMany({ where: { userId: id } });

  return NextResponse.json({
    ok: true,
    student: { id: u.id, email: u.email },
  });
});
