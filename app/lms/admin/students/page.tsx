import { requireRoleForPage } from "@/shared/lib/rbac";
import AdminStudentsClient from "./AdminStudentsClient";

export default async function AdminStudentsPage() {
  await requireRoleForPage(["ADMIN"], { adminBypass: true, loginPath: "/login" });
  return <AdminStudentsClient />;
}
