import { withAdminApiGuard } from "@/shared/lib/admin-api/guard";
import { listCourses } from "@/shared/lib/admin-api/services/courses.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAdminApiGuard(["content:read"], async (request) => {
  const params = new URL(request.url).searchParams;
  return listCourses({ limit: params.get("limit") ?? undefined, cursor: params.get("cursor") ?? undefined });
});
