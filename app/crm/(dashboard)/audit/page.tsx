import { CRM_ROLES } from "@/shared/lib/auth";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { db } from "@/shared/lib/db";
import { sortByRu } from "@/shared/lib/sortRu";
import { parseAuditLogFilters, listAuditLogPage } from "@/crm/lib/services/audit-list.service";
import { AuditClient } from "@/crm/components/audit/AuditClient";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRoleForPage(["ADMIN"], {
    loginPath: "/admin/login",
    forbiddenPath: () => "/access-denied",
  });

  const sp = await searchParams;
  const filters = parseAuditLogFilters(sp);

  const [{ logs, total, page, pageSize }, staffRaw] = await Promise.all([
    listAuditLogPage(filters),
    db.user.findMany({
      where: { role: { in: CRM_ROLES } },
      select: { id: true, fullName: true },
    }),
  ]);
  const staff = sortByRu(staffRaw, (s) => s.fullName);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="page-title">Журнал действий</h1>
        <p className="page-subtitle">
          История изменений в системе: кто и когда что создал, изменил или удалил.
        </p>
      </div>

      <AuditClient
        initialLogs={logs.map((l) => ({
          id: l.id,
          userId: l.userId,
          userName: l.userName,
          userRole: l.userRole,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          entityTitle: l.entityTitle,
          details: l.details,
          createdAt: l.createdAt.toISOString(),
        }))}
        initialTotal={total}
        initialFilters={{ ...filters, page, pageSize }}
        staff={staff}
      />
    </div>
  );
}
