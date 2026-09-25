import { requireRoleForPage } from "@/shared/lib/rbac";
import { roleHome } from "@/lms/server/auth/types";
import { getCourseOwnerOptions, getCourseSummaries } from "@/lms/server/admin/catalog";
import { PageHeader } from "@/lms/components/admin/primitives";

import { CoursesClient } from "./CoursesClient";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const user = await requireRoleForPage(["ADMIN", "MANAGER"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });

  const [courses, owners] = await Promise.all([getCourseSummaries(user), getCourseOwnerOptions()]);

  return (
    <div>
      <PageHeader
        eyebrow="Учебный контент"
        title="Курсы"
        description="Предмет и экзамен задаются на уровне курса — все его модули и уроки наследуют их. Курс видят в кабинете преподавателя его владелец, отмеченные «Преподаватели курса» и преподаватели CRM-групп того же предмета."
      />
      <CoursesClient courses={courses} owners={owners} />
    </div>
  );
}
