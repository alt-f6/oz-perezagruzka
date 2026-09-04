import { requireRoleForPage } from "@/shared/lib/rbac";
import { roleHome } from "@/lms/server/auth/types";
import AdminAssignmentsClient from "./ui";

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string; lessonId?: string }>;
}) {
  await requireRoleForPage(["ADMIN"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });

  const sp = await searchParams;
  const initialStudentId = sp?.studentId ? sp.studentId : null;
  const initialLessonId = sp?.lessonId ? sp.lessonId : null;

  return <AdminAssignmentsClient initialStudentId={initialStudentId} initialLessonId={initialLessonId} />;
}
