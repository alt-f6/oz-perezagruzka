import { redirect } from "next/navigation";
import { CRM_ROLES, getSessionUser } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import type { GroupWithDetails, User } from "@/crm/lib/types";
import { GroupsClient } from "./GroupsClient";

export default async function GroupsPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/admin/login");
  }

  if (!CRM_ROLES.includes(sessionUser.role)) {
    redirect("/");
  }

  const userRole = sessionUser.role;
  const isTeacher = userRole === "TEACHER";

  const [groups, teachers, students] = await Promise.all([
    db.group.findMany({
      where: {
        deletedAt: null,
        ...(isTeacher && sessionUser ? { teacherId: sessionUser.id } : {}),
      },
      select: {
        id: true,
        name: true,
        teacherId: true,
        pricePerLesson: true,
        createdAt: true,
        deletedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    !isTeacher
      ? db.user.findMany({
          where: { role: "TEACHER" },
          select: { id: true, fullName: true },
        })
      : Promise.resolve([]),
    db.student.findMany({
      where: {
        deletedAt: null,
        ...(isTeacher
          ? { groups: { some: { group: { teacherId: sessionUser.id } } } }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        groups: { select: { groupId: true } },
      },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const groupsWithDetails = groups.map((group) => {
    const teacher = teachers.find((t) => t.id === group.teacherId);
    const groupStudents = students.filter((s) =>
      s.groups.some((g) => g.groupId === group.id),
    );

    return {
      ...group,
      pricePerLesson: Number(group.pricePerLesson ?? 0),
      teacher: teacher ? { fullName: teacher.fullName } : null,
      students: groupStudents.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        phone: s.phone,
      })),
    };
  });

  return (
    <GroupsClient
      groups={groupsWithDetails as unknown as GroupWithDetails[]}
      teachers={teachers as unknown as User[]}
      allStudents={students.map((s) => ({ id: s.id, fullName: s.fullName }))}
      userRole={userRole}
    />
  );
}
