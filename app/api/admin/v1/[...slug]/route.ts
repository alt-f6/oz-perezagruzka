import { AdminApiError } from "@/shared/lib/admin-api/errors";
import { withAdminApiGuard } from "@/shared/lib/admin-api/guard";

// Unknown /api/admin/v1/* paths answer in the API's JSON error format (after
// auth, so the route map isn't probeable anonymously) instead of an HTML 404.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAdminApiGuard<{ slug: string[] }>(
  [],
  async () => {
    throw new AdminApiError(404, "not_found", "Такого метода API нет");
  },
);
