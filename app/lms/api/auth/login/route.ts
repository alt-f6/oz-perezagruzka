import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/shared/lib/db";
import { authenticateWithPassword, createUserSession, signToken, SESSION_COOKIE_NAME } from "@/shared/lib/auth";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function extractIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const legacyIp = (req as unknown as { ip?: string }).ip;
  if (legacyIp) return legacyIp;

  return "unknown";
}

async function isRateLimited(ip: string, email: string): Promise<boolean> {
  const row = await db.loginAttempt.findUnique({ where: { ipAddress_email: { ipAddress: ip, email } } });
  if (!row) return false;

  const withinWindow = Date.now() - row.lastAttempt.getTime() < RATE_LIMIT_WINDOW_MS;
  return withinWindow && row.attemptCount >= RATE_LIMIT_MAX_ATTEMPTS;
}

async function recordFailedAttempt(ip: string, email: string): Promise<void> {
  const existing = await db.loginAttempt.findUnique({ where: { ipAddress_email: { ipAddress: ip, email } } });
  const withinWindow =
    existing && Date.now() - existing.lastAttempt.getTime() < RATE_LIMIT_WINDOW_MS;

  await db.loginAttempt.upsert({
    where: { ipAddress_email: { ipAddress: ip, email } },
    create: { ipAddress: ip, email, attemptCount: 1 },
    update: { attemptCount: withinWindow ? { increment: 1 } : 1, lastAttempt: new Date() },
  });
}

async function clearFailedAttempts(ip: string, email: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { ipAddress: ip, email } });
}

export const POST = withApiErrors(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "email and password required" },
      { status: 400 }
    );
  }

  const ip = extractIp(req);

  if (await isRateLimited(ip, email)) {
    return NextResponse.json(
      { ok: false, error: "too_many_attempts" },
      { status: 429 }
    );
  }

  const user = await authenticateWithPassword(email, password);

  if (!user) {
    await recordFailedAttempt(ip, email);

    return NextResponse.json(
      { ok: false, error: "invalid credentials" },
      { status: 401 }
    );
  }

  await clearFailedAttempts(ip, email);

  const { token, expiresAt } = await createUserSession(user.id);

  const jar = await cookies();

  jar.set(SESSION_COOKIE_NAME, signToken(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return NextResponse.json({ ok: true });
});
