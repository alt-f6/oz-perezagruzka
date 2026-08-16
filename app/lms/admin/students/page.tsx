import { requireRolePage } from "@/lms/server/auth/require-role-page";
import AdminStudentsClient from "./AdminStudentsClient";

export default async function AdminStudentsPage() {
  await requireRolePage("ADMIN");
  return <AdminStudentsClient />;
}
