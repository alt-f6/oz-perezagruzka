import { withAdminApiGuard } from "@/shared/lib/admin-api/guard";
import { findStudents } from "@/shared/lib/admin-api/services/students.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAdminApiGuard(["students:read"], async (request) => {
  const query = new URL(request.url).searchParams.get("query");
  return { items: await findStudents(query) };
});
