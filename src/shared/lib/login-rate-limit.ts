import { db } from "@/shared/lib/db";

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

export async function isLoginRateLimited(ip: string, email: string): Promise<boolean> {
  const row = await db.loginAttempt.findUnique({ where: { ipAddress_email: { ipAddress: ip, email } } });
  const withinWindow = row ? Date.now() - row.lastAttempt.getTime() < RATE_LIMIT_WINDOW_MS : false;
  if (withinWindow && row!.attemptCount >= RATE_LIMIT_MAX_ATTEMPTS) return true;

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const emailRows = await db.loginAttempt.findMany({
    where: { email, lastAttempt: { gte: windowStart } },
    select: { attemptCount: true },
    take: 500,
  });
  const totalRecentAttempts = emailRows.reduce((sum, r) => sum + r.attemptCount, 0);

  return totalRecentAttempts >= EMAIL_RATE_LIMIT_MAX_ATTEMPTS;
}

export async function recordFailedLoginAttempt(ip: string, email: string): Promise<void> {
  const existing = await db.loginAttempt.findUnique({ where: { ipAddress_email: { ipAddress: ip, email } } });
  const withinWindow = existing && Date.now() - existing.lastAttempt.getTime() < RATE_LIMIT_WINDOW_MS;

  await db.loginAttempt.upsert({
    where: { ipAddress_email: { ipAddress: ip, email } },
    create: { ipAddress: ip, email, attemptCount: 1 },
    update: { attemptCount: withinWindow ? { increment: 1 } : 1, lastAttempt: new Date() },
  });
}

// Clears every ipAddress/email row for this email, not just the caller's IP —
// otherwise a rotating-IP attacker's stale rows would accumulate unbounded
// even after the legitimate owner logs in successfully.
export async function clearLoginAttempts(email: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { email } });
}
