import { redirect } from "next/navigation";
import { db } from "@/shared/lib/db";
import { CRM_ROLES, getSessionUser } from "@/shared/lib/auth";
import type { Group } from "@/crm/lib/types";
import { listStudents } from "@/crm/lib/services/student-list.service";
import { StudentsClient } from "./StudentsClient";

export default async function StudentsPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/admin/login");
  }

  if (!CRM_ROLES.includes(sessionUser.role)) {
    redirect("/");
  }

  const isTeacher = sessionUser.role === "TEACHER";

  const [{ students, nextCursor }, groups] = await Promise.all([
    listStudents({ sessionUser }),
    db.group.findMany({
      where: {
        deletedAt: null,
        ...(isTeacher ? { teacherId: sessionUser.id } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, teacherId: true },
    }),
  ]);

  return (
    <StudentsClient
      initialStudents={students}
      initialNextCursor={nextCursor}
      groups={groups as Group[]}
      userRole={sessionUser.role}
    />
  );
}
