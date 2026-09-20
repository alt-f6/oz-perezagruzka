import { db } from "@/shared/lib/db";
import { CRM_ROLES } from "@/shared/lib/auth";
import { requireRoleForPage } from "@/shared/lib/rbac";
import type { Group } from "@/crm/lib/types";
import { listStudents } from "@/crm/lib/services/student-list.service";
import { sortByRu } from "@/shared/lib/sortRu";
import { StudentsClient } from "./StudentsClient";

export default async function StudentsPage() {
  const sessionUser = await requireRoleForPage(CRM_ROLES, {
    loginPath: "/admin/login",
    forbiddenPath: () => "/access-denied",
  });

  const isTeacher = sessionUser.role === "TEACHER";

  const [{ students, nextCursor }, groupsRaw] = await Promise.all([
    listStudents({ sessionUser }),
    db.group.findMany({
      where: {
        deletedAt: null,
        ...(isTeacher ? { teacherId: sessionUser.id } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, teacherId: true },
    }),
  ]);
  const groups = sortByRu(groupsRaw, (g) => g.name);

  return (
    <StudentsClient
      initialStudents={students}
      initialNextCursor={nextCursor}
      groups={groups as Group[]}
      userRole={sessionUser.role}
    />
  );
}
