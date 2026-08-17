import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/shared/lib/db";
import { authenticateWithPassword, createUserSession, signToken, SESSION_COOKIE_NAME } from "@/shared/lib/auth";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { createLogger } from "@/shared/lib/logger";

export const runtime = "nodejs";

const log = createLogger("crm-login");

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
// A client can freely set its own X-Forwarded-For header on a direct request
// (there's no verified trusted-proxy chain here), so a per-(ip,email) limit
// alone can be bypassed by sending a different spoofed IP on every attempt.
// This aggregate, email-only cap can't be bypassed by IP spoofing since it
// doesn't key on IP at all. Threshold is higher than the per-IP one so
// legitimate users sharing an IP pool (NAT, corporate network) aren't
// penalized for each other's mistyped passwords.
const EMAIL_RATE_LIMIT_MAX_ATTEMPTS = 20;

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
  const withinWindow = row ? Date.now() - row.lastAttempt.getTime() < RATE_LIMIT_WINDOW_MS : false;
  if (withinWindow && row!.attemptCount >= RATE_LIMIT_MAX_ATTEMPTS) return true;

  const emailRows = await db.loginAttempt.findMany({ where: { email } });
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
  const totalRecentAttempts = emailRows
    .filter((r) => r.lastAttempt.getTime() >= windowStart)
    .reduce((sum, r) => sum + r.attemptCount, 0);

  return totalRecentAttempts >= EMAIL_RATE_LIMIT_MAX_ATTEMPTS;
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
    return NextResponse.json({ ok: false, error: "email and password required" }, { status: 400 });
  }

  const ip = extractIp(req);

  if (await isRateLimited(ip, email)) {
    log.warn("login_rate_limited", { email, ip });
    return NextResponse.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
  }

  const user = await authenticateWithPassword(email, password);
  if (!user) {
    await recordFailedAttempt(ip, email);

    log.warn("login_failed", { email, ip });
    return NextResponse.json({ ok: false, error: "invalid credentials" }, { status: 401 });
  }

  await clearFailedAttempts(ip, email);
  log.info("login_success", { userId: user.id, role: user.role });

  const { token, expiresAt } = await createUserSession(user.id);

  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, signToken(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return NextResponse.json({ ok: true, role: user.role });
});
