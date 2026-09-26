import { withAdminApiGuard } from "@/shared/lib/admin-api/guard";
import { getCourseTree } from "@/shared/lib/admin-api/services/courses.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAdminApiGuard<{ id: string }>(["content:read"], async (_request, { params }) =>
  getCourseTree(params.id),
);
