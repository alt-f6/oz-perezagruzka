import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { hashPassword } from "@/shared/lib/auth";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { buildCursorPage, parsePaginationParams } from "@/shared/lib/pagination";

export const runtime = "nodejs";

function isValidEmail(email: string) {
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export const GET = withApiErrors(async (req: NextRequest) => {
  await requireRole(["ADMIN"], { adminBypass: true });

  const { cursor, limit } = parsePaginationParams(new URL(req.url).searchParams, 1000);

  const rows = await db.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, email: true, role: true, fullName: true },
    orderBy: { id: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const { items: students, nextCursor } = buildCursorPage(rows, limit);

  return NextResponse.json({ ok: true, students, nextCursor });
});

export const POST = withApiErrors(async (req: NextRequest) => {
  await requireRole(["ADMIN"], { adminBypass: true });

  const body = await req.json().catch(() => ({} as any));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const first_name = String(body.first_name ?? "").trim();
  const last_name = String(body.last_name ?? "").trim();

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "bad_email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
  }
  if (!first_name || !last_name) {
    return NextResponse.json({ ok: false, error: "bad_name" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ ok: false, error: "email_exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const fullName = `${first_name} ${last_name}`.trim();

  const student = await db.user.create({
    data: { email, passwordHash, role: "STUDENT", fullName },
    select: { id: true, email: true, role: true, fullName: true },
  });

  return NextResponse.json({ ok: true, student });
});
