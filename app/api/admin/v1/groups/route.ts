import { withAdminApiGuard } from "@/shared/lib/admin-api/guard";
import { listGroups } from "@/shared/lib/admin-api/services/groups.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAdminApiGuard(["students:read"], async () => listGroups());
