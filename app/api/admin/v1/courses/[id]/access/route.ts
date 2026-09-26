import { withAdminApiGuard } from "@/shared/lib/admin-api/guard";
import { getCourseAccess } from "@/shared/lib/admin-api/services/access.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAdminApiGuard<{ id: string }>(["content:read", "students:read"], async (_request, { params }) =>
  getCourseAccess(params.id),
);
