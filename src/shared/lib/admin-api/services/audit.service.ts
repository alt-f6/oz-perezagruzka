import type { Prisma } from "@prisma/client";
import { db } from "@/shared/lib/db";
import { invalidParam } from "../errors";
import { scrubPiiFromPayload, scrubPiiFromString } from "../pii";
import { toMoscowIso } from "../time";
import { normalizeLimit } from "../validation";

// The admin-API journal (AdminAuditLog), newest first. `before` is either the
// id of the last entry already seen (keyset pagination, stable under inserts)
// or an ISO 8601 timestamp. before/after snapshots and reason are PII-scrubbed.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function beforeFilter(raw: unknown): Promise<Prisma.AdminAuditLogWhereInput> {
  if (raw === undefined || raw === null || raw === "") return {};
  const invalid = () =>
    invalidParam("before", "Параметр before должен быть id записи журнала или датой в формате ISO 8601");
  if (typeof raw !== "string" || raw.length > 64) throw invalid();

  if (UUID_RE.test(raw)) {
    const anchor = await db.adminAuditLog.findUnique({ where: { id: raw }, select: { id: true, createdAt: true } });
    if (!anchor) throw invalid();
    return {
      OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }],
    };
  }

  const at = new Date(raw);
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw) || Number.isNaN(at.getTime())) throw invalid();
  return { createdAt: { lt: at } };
}

export async function listAuditLog(input: { limit?: unknown; before?: unknown } = {}) {
  const limit = normalizeLimit(input.limit);
  const where = await beforeFilter(input.before);

  const rows = await db.adminAuditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map((r) => ({
      id: r.id,
      createdAt: toMoscowIso(r.createdAt),
      tokenId: r.tokenId,
      endpoint: r.endpoint,
      targetType: r.targetType,
      targetId: r.targetId,
      before: scrubPiiFromPayload(r.before),
      after: scrubPiiFromPayload(r.after),
      reason: r.reason === null ? null : scrubPiiFromString(r.reason),
      dryRun: r.dryRun,
      requestId: r.requestId,
    })),
    nextBefore: hasMore ? page[page.length - 1].id : null,
  };
}
