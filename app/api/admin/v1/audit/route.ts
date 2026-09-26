import { withAdminApiGuard } from "@/shared/lib/admin-api/guard";
import { listAuditLog } from "@/shared/lib/admin-api/services/audit.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAdminApiGuard(["content:read"], async (request) => {
  const params = new URL(request.url).searchParams;
  return listAuditLog({ limit: params.get("limit") ?? undefined, before: params.get("before") ?? undefined });
});
