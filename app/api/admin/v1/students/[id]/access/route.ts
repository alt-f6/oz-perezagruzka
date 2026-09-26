import { withAdminApiGuard } from "@/shared/lib/admin-api/guard";
import { getStudentAccess } from "@/shared/lib/admin-api/services/access.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAdminApiGuard<{ id: string }>(["students:read"], async (_request, { params }) =>
  getStudentAccess(params.id),
);
