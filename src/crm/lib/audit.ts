import type { Prisma } from "@prisma/client";
import { db } from "@/shared/lib/db";
import { createLogger } from "@/shared/lib/logger";

const log = createLogger("crm.audit");

const SENSITIVE_KEY_PATTERN = /password|hash|secret|token|cookie/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitize(val);
    }
    return result;
  }
  return value;
}

export interface LogActivityParams {
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityTitle?: string | null;
  details?: Record<string, unknown> | null;
}

/**
 * Writes one row to the ActivityLog audit trail. Never throws: a logging
 * failure must never abort the business action that already succeeded, so
 * every failure here is caught and reported via the logger instead of
 * propagating to the caller.
 *
 * `userName` is optional -- SessionUser (src/shared/lib/auth.ts) doesn't
 * carry a fullName, so most callers only have userId/userRole on hand. When
 * userName is omitted and userId is set, the user's current fullName is
 * looked up once, here, rather than duplicating that query at every call
 * site. That lookup is itself best-effort: a failure falls back to the
 * schema's "Система" placeholder instead of blocking the audit write.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  let userName = params.userName ?? null;

  if (!userName && params.userId) {
    try {
      const user = await db.user.findUnique({
        where: { id: params.userId },
        select: { fullName: true },
      });
      userName = user?.fullName ?? null;
    } catch (err) {
      log.error("Не удалось получить имя пользователя для аудита", err, {
        userId: params.userId,
      });
    }
  }

  try {
    await db.activityLog.create({
      data: {
        userId: params.userId ?? null,
        userName: userName ?? "Система",
        userRole: params.userRole ?? "SYSTEM",
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        entityTitle: params.entityTitle ?? null,
        details: params.details
          ? (sanitize(params.details) as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (err) {
    log.error("Не удалось записать событие аудита", err, {
      action: params.action,
      entityType: params.entityType,
    });
  }
}
