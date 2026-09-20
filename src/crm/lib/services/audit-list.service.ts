import { db } from "@/shared/lib/db";
import { auditLogFiltersSchema, type AuditLogFilters } from "@/crm/lib/schemas";

/**
 * Parses raw Next.js searchParams (or any plain query object, array values
 * included) into typed, defaulted audit-log filters. Every field falls back
 * to a safe default rather than throwing, so a malformed/stale URL never
 * 500s the /audit page.
 */
export function parseAuditLogFilters(
  raw: Record<string, string | string[] | undefined>,
): AuditLogFilters {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  return auditLogFiltersSchema.parse(flat);
}

export interface AuditLogRow {
  id: string;
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityTitle: string | null;
  details: unknown;
  createdAt: Date;
}

export interface ListAuditLogPageResult {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listAuditLogPage(filters: AuditLogFilters): Promise<ListAuditLogPageResult> {
  const where = {
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.q
      ? {
          OR: [
            { entityTitle: { contains: filters.q, mode: "insensitive" as const } },
            { userName: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    db.activityLog.count({ where }),
  ]);

  return { logs, total, page: filters.page, pageSize: filters.pageSize };
}
