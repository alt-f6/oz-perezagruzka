import { redirect } from "next/navigation";
import { getSessionUser } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import { ParentDashboardClient } from "./ParentDashboardClient";

export interface ChildOption {
  id: string;
  fullName: string;
}

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { studentId } = await searchParams;
  const sessionUser = await getSessionUser();

  const parent = sessionUser
    ? await db.parent.findUnique({
        where: { userId: sessionUser.id },
        select: { id: true, fullName: true },
      })
    : null;

  if (!parent) {
    redirect("/");
  }

  const parentStudents = await db.parentStudent.findMany({
    where: { parentId: parent.id },
    select: { student: { select: { id: true, fullName: true } } },
  });

  const children: ChildOption[] = parentStudents
    .map((row) => (row.student ? { id: row.student.id, fullName: row.student.fullName } : null))
    .filter((c): c is ChildOption => c !== null);

  if (children.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white p-8 text-center text-accent/50">
        К вашему аккаунту не привязан ни один ученик. Обратитесь к администратору.
      </div>
    );
  }

  const activeChild =
    children.find((c) => c.id === studentId) ?? children[0];

  if (studentId && activeChild.id !== studentId) {
    redirect(`/parent/dashboard?studentId=${activeChild.id}`);
  }

  const [balanceRow, transactionRows, groupStudentRows] = await Promise.all([
    db.studentBalanceView.findUnique({
      where: { studentId: activeChild.id },
      select: { totalBalance: true },
    }),
    db.transaction.findMany({
      where: { studentId: activeChild.id },
      select: { id: true, amount: true, type: true, description: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.groupStudent.findMany({
      where: { studentId: activeChild.id },
      select: { group: { select: { id: true, name: true, pricePerLesson: true } } },
    }),
  ]);

  const groups = groupStudentRows
    .map((row) => row.group)
    .filter((g) => g !== null)
    .map((g) => ({ id: g.id, name: g.name, pricePerLesson: Number(g.pricePerLesson) }));

  const transactions = transactionRows.map((t) => ({
    id: t.id,
    amount: Number(t.amount),
    type: t.type,
    description: t.description,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <ParentDashboardClient
      parentName={parent.fullName}
      childStudents={children}
      activeChildId={activeChild.id}
      totalBalance={Number(balanceRow?.totalBalance ?? 0)}
      transactions={transactions}
      groups={groups}
    />
  );
}
