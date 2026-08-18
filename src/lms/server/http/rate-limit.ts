import { db } from "@/shared/lib/db";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

// Shares the RateLimitBucket table with the landing module's rate limiter
// (both point at the same Postgres database via prisma/schema.prisma).
// Single-statement atomic upsert avoids a read-then-write race under
// concurrent requests — see src/landing/lib/rate-limit.ts for the same
// pattern with more detail.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = new Date();
  const freshResetAt = new Date(now.getTime() + windowMs);

  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" AS rlb ("key", "count", "resetAt")
    VALUES (${key}, 1, ${freshResetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN rlb."resetAt" <= ${now} THEN 1 ELSE rlb."count" + 1 END,
      "resetAt" = CASE WHEN rlb."resetAt" <= ${now} THEN ${freshResetAt} ELSE rlb."resetAt" END
    RETURNING "count", "resetAt"
  `;

  const row = rows[0];
  const resetAt = row.resetAt.getTime();

  if (row.count > limit) {
    return { success: false, remaining: 0, resetAt };
  }

  return { success: true, remaining: Math.max(0, limit - row.count), resetAt };
}

export async function enforceRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const result = await checkRateLimit(key, limit, windowMs);
  if (!result.success) {
    const err = new Error("rate_limited");
    (err as any).status = 429;
    throw err;
  }
}
