import { requireRoleForPage } from "@/shared/lib/rbac";
import AdminAssignmentsClient from "./ui";

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  await requireRoleForPage(["ADMIN"], { adminBypass: true, loginPath: "/login" });

  const sp = await searchParams;
  const initialStudentId = sp?.studentId ? sp.studentId : null;

  return <AdminAssignmentsClient initialStudentId={initialStudentId} />;
}
