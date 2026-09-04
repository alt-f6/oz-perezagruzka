import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "@/shared/lib/db";
import { hashPassword, createUserSession, signToken, SESSION_COOKIE_NAME } from "@/shared/lib/auth";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

// All portal roles (student/parent) authenticate through the CRM login page,
// which dispatches to the right home by role after sign-in. Register lives on
// the same origin, so a relative path is enough for the "already registered"
// hand-off.
const LOGIN_PATH = "/admin/login";

// Public invite preview: token possession is the access control (matches the
// previous Postgrest read of unaccepted invites by token). This handler is
// strictly READ-ONLY — a crawler/link-preview GET never mutates the invite,
// so it can't burn the token before the user submits the form.
export const GET = withApiErrors(async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });
  }

  // Look the invite up by token ALONE (not `acceptedAt: null`), so an already
  // accepted invite is distinguishable from a genuinely unknown token and can
  // be routed to login instead of a dead-end "invalid" error.
  const invite = await db.invite.findFirst({
    where: { token },
    select: { id: true, email: true, role: true, acceptedAt: true, expiresAt: true },
  });

  if (!invite) {
    return NextResponse.json({ ok: false, error: "Недействительное или уже использованное приглашение" }, { status: 404 });
  }

  if (invite.acceptedAt) {
    return NextResponse.json(
      {
        ok: false,
        alreadyAccepted: true,
        loginPath: LOGIN_PATH,
        error: "Это приглашение уже активировано. Войдите в личный кабинет.",
      },
      { status: 409 },
    );
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

  // Look up by token alone so an already-accepted invite is reported as such
  // (with a login hand-off) rather than as an "invalid" dead-end.
  const invite = await db.invite.findFirst({ where: { token } });
  if (!invite) {
    return NextResponse.json({ ok: false, error: "Недействительное или уже использованное приглашение" }, { status: 404 });
  }

  if (invite.acceptedAt) {
    return NextResponse.json(
      {
        ok: false,
        alreadyAccepted: true,
        loginPath: LOGIN_PATH,
        error: "Это приглашение уже активировано. Войдите в личный кабинет.",
      },
      { status: 409 },
    );
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

  // Account creation, profile linkage, and invite consumption must be atomic:
  // otherwise a failure after the User is created but before `acceptedAt` is
  // set leaves an orphan account AND an unconsumed invite, and the retry hits
  // the "email already registered" branch instead of completing cleanly.
  let user;
  try {
    user = await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: invite.email } });
      const u = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { fullName, passwordHash, role: invite.role } })
        : await tx.user.create({ data: { email: invite.email, fullName, passwordHash, role: invite.role } });

      if (invite.role === "STUDENT" && invite.studentId) {
        await tx.student.update({ where: { id: invite.studentId }, data: { userId: u.id } });
      }

      if (invite.role === "PARENT" && invite.parentId) {
        await tx.parent.update({ where: { id: invite.parentId }, data: { userId: u.id } });
      }

      await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });

      return u;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Пользователь с таким email уже зарегистрирован" }, { status: 409 });
    }
    throw error;
  }

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
