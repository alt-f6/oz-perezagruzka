import { prisma } from "@/landing/lib/db";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

interface BucketRow {
  count: number;
  resetAt: Date;
}

// Single-statement atomic upsert: if the existing row's window has expired,
// reset the counter to 1 with a fresh window; otherwise increment. Doing this
// as one INSERT ... ON CONFLICT (rather than a read-then-write, even inside a
// Prisma $transaction under Postgres's default READ COMMITTED isolation)
// avoids a race where two concurrent requests both read count < limit and
// both get admitted.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const freshResetAt = new Date(now.getTime() + windowMs);

  const rows = await prisma.$queryRaw<BucketRow[]>`
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
