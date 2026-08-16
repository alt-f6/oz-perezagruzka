import { requireRolePage } from "@/lms/server/auth/require-role-page";
import AdminAssignmentsClient from "./ui";

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  await requireRolePage("ADMIN");

  const sp = await searchParams;
  const initialStudentId = sp?.studentId ? sp.studentId : null;

  return <AdminAssignmentsClient initialStudentId={initialStudentId} />;
}
