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

  const isTeacher = sessionUser.role === "TEACHER";

  const [students, groups] = await Promise.all([
    db.student.findMany({
      where: {
        deletedAt: null,
        ...(isTeacher
          ? { groups: { some: { group: { teacherId: sessionUser.id } } } }
          : {}),
      },
      take: 1000,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        fullName: true,
        groups: {
          select: {
            group: { select: { id: true, name: true, teacherId: true } },
          },
        },
        // Teachers never see contact details or financial data, so these
        // aren't even queried for them, not just hidden client-side.
        ...(isTeacher
          ? {}
          : { phone: true, transactions: { select: { amount: true } } }),
      },
    }),

    db.group.findMany({
      where: {
        deletedAt: null,
        ...(isTeacher ? { teacherId: sessionUser.id } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, teacherId: true },
    }),
  ]);

  const mappedStudents = students.map((s) => {
    const withFinancials = s as typeof s & {
      phone?: string | null;
      transactions?: { amount: unknown }[];
    };
    return {
      id: s.id,
      fullName: s.fullName,
      phone: isTeacher ? null : (withFinancials.phone ?? null),
      groups: s.groups.map((g) => g.group).filter(Boolean),
      transactions: isTeacher
        ? []
        : (withFinancials.transactions ?? []).map((t) => ({
            amount: Number(t.amount),
          })),
    };
  });

  return (
    <StudentsClient
      students={mappedStudents as unknown as StudentRow[]}
      groups={groups}
      userRole={sessionUser.role}
    />
  );
}
