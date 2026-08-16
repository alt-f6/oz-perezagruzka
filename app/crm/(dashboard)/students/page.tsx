import { redirect } from "next/navigation";
import { db } from "@/shared/lib/db";
import { CRM_ROLES, getSessionUser } from "@/shared/lib/auth";
import type { Group, Student } from "@/crm/lib/types";
import { StudentsClient } from "./StudentsClient";

type StudentRow = Student & {
  groups: Group[];
  transactions?: { amount: number }[];
};

export default async function StudentsPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/admin/login");
  }

  if (!CRM_ROLES.includes(sessionUser.role)) {
    redirect("/");
  }

  const [students, groups] = await Promise.all([
    db.student.findMany({
      where: { deletedAt: null },
      take: 1000,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        fullName: true,
        phone: true,
        groups: {
          select: {
            group: { select: { id: true, name: true, teacherId: true } },
          },
        },
        transactions: { select: { amount: true } },
      },
    }),

    db.group.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, teacherId: true },
    }),
  ]);

  const mappedStudents = students.map((s) => ({
    ...s,
    groups: s.groups.map((g) => g.group).filter(Boolean),
    transactions: s.transactions.map((t) => ({ amount: Number(t.amount) })),
  }));

  return (
    <StudentsClient
      students={mappedStudents as unknown as StudentRow[]}
      groups={groups}
      userRole={sessionUser.role}
    />
  );
}
