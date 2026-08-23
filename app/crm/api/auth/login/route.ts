import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authenticateWithPassword, createUserSession, signToken, SESSION_COOKIE_NAME } from "@/shared/lib/auth";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { createLogger } from "@/shared/lib/logger";
import { isLoginRateLimited, recordFailedLoginAttempt, clearLoginAttempts } from "@/shared/lib/login-rate-limit";

export const runtime = "nodejs";

const log = createLogger("crm-login");

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

export const POST = withApiErrors(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "email and password required" }, { status: 400 });
  }

  const ip = extractIp(req);

  if (await isLoginRateLimited(ip, email)) {
    log.warn("login_rate_limited", { email, ip });
    return NextResponse.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
  }

  const user = await authenticateWithPassword(email, password);
  if (!user) {
    await recordFailedLoginAttempt(ip, email);

    log.warn("login_failed", { email, ip });
    return NextResponse.json({ ok: false, error: "invalid credentials" }, { status: 401 });
  }

  await clearLoginAttempts(email);
  log.info("login_success", { userId: user.id, role: user.role });

  const { token, expiresAt } = await createUserSession(user.id);

  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, signToken(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  });

  return NextResponse.json({ ok: true, role: user.role });
});
