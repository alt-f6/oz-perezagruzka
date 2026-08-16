import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "@/shared/lib/db";
import { hashPassword, createUserSession, signToken, SESSION_COOKIE_NAME } from "@/shared/lib/auth";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

// Public invite preview: token possession is the access control (matches the
// previous Postgrest read of unaccepted invites by token).
export const GET = withApiErrors(async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });
  }

  const invite = await db.invite.findFirst({
    where: { token, acceptedAt: null },
    select: { id: true, email: true, role: true, acceptedAt: true, expiresAt: true },
  });

  if (!invite) {
    return NextResponse.json({ ok: false, error: "Недействительное или уже использованное приглашение" }, { status: 404 });
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: "Срок действия приглашения истёк. Обратитесь к администратору за новой ссылкой." }, { status: 410 });
  }

  return NextResponse.json({ ok: true, invite });
});

export const POST = withApiErrors(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const token = String(body?.token || "");
  const fullName = String(body?.name || "").trim();
  const password = String(body?.password || "");

  if (!token || !fullName || password.length < 6) {
    return NextResponse.json({ ok: false, error: "invalid input" }, { status: 400 });
  }

  const invite = await db.invite.findFirst({ where: { token, acceptedAt: null } });
  if (!invite) {
    return NextResponse.json({ ok: false, error: "Недействительное или уже использованное приглашение" }, { status: 404 });
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: "Срок действия приглашения истёк. Обратитесь к администратору за новой ссылкой." }, { status: 410 });
  }

  if (!invite.studentId && invite.role === "STUDENT") {
    return NextResponse.json({ ok: false, error: "Приглашение повреждено: не указан ученик" }, { status: 400 });
  }

  if (!invite.parentId && invite.role === "PARENT") {
    return NextResponse.json({ ok: false, error: "Приглашение повреждено: не указан родитель" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    const existing = await db.user.findUnique({ where: { email: invite.email } });
    user = existing
      ? await db.user.update({ where: { id: existing.id }, data: { fullName, passwordHash, role: invite.role } })
      : await db.user.create({ data: { email: invite.email, fullName, passwordHash, role: invite.role } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Пользователь с таким email уже зарегистрирован" }, { status: 409 });
    }
    throw error;
  }

  if (invite.role === "STUDENT" && invite.studentId) {
    await db.student.update({ where: { id: invite.studentId }, data: { userId: user.id } });
  }

  if (invite.role === "PARENT" && invite.parentId) {
    await db.parent.update({ where: { id: invite.parentId }, data: { userId: user.id } });
  }

  await db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });

  const { token: sessionToken, expiresAt } = await createUserSession(user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, signToken(sessionToken), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return NextResponse.json({ ok: true, role: user.role });
});
