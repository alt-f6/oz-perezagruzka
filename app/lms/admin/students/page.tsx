import { requireRoleForPage } from "@/shared/lib/rbac";
import { roleHome } from "@/lms/server/auth/types";
import AdminStudentsClient from "./AdminStudentsClient";

export default async function AdminStudentsPage() {
  await requireRoleForPage(["ADMIN"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });
  return <AdminStudentsClient />;
}
