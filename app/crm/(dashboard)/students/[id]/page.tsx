import { notFound } from "next/navigation";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { PaymentModal } from "@/crm/components/PaymentModal";
import { ExamTrackerSection } from "./ExamTrackerSection";
import { FreezeSection } from "./FreezeSection";
import { PortalInviteSection } from "./PortalInviteSection";
import { TelegramLinkSection } from "./TelegramLinkSection";
import { createStudentPaymentSession } from "./payment-actions";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  const { id } = await params;

  if (sessionUser.role === "TEACHER") {
    const link = await db.groupStudent.findFirst({
      where: { studentId: id, group: { teacherId: sessionUser.id } },
      select: { studentId: true },
    });
    if (!link) {
      return (
        <div className="p-8 text-sm text-slate-500">
          Ученик не входит в ваши группы
        </div>
      );
    }
  }

  const student = await db.student.findUnique({ where: { id } });

  if (!student) {
    notFound();
  }

  const balanceAgg = await db.transaction.aggregate({
    where: { studentId: id },
    _sum: { amount: true },
  });
  const computedBalance = Number(balanceAgg._sum.amount ?? 0);

  const [examGoals, examResults, parentLinks, freezes] = await Promise.all([
    db.studentExamGoal.findMany({ where: { studentId: id } }),
    db.studentExamResult.findMany({
      where: { studentId: id },
      orderBy: { testedAt: "desc" },
    }),
    db.parentStudent.findMany({
      where: { studentId: id },
      select: {
        parent: { select: { id: true, fullName: true, telegramChatId: true } },
      },
    }),
    db.freeze.findMany({
      where: { studentId: id },
      orderBy: { startDate: "desc" },
      select: { id: true, startDate: true, endDate: true },
    }),
  ]);

  const parents = parentLinks.map((row) => row.parent).filter(Boolean);

  const mappedExamResults = examResults.map((r) => ({
    ...r,
    testedAt: r.testedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="card flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg font-semibold text-slate-900">
            {student.fullName
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0] ?? "")
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900">
              {student.fullName}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Телефон: {student.phone || "Не указан"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-right">
            <p className="overline">Баланс</p>
            <p
              className={`text-lg font-semibold tracking-tight ${
                computedBalance < 0 ? "text-cancel" : "text-emerald-600"
              }`}
            >
              {computedBalance.toLocaleString("ru-RU")} ₽
            </p>
          </div>
          <PaymentModal studentId={id} createPaymentSession={createStudentPaymentSession} />
        </div>
      </div>

      <PortalInviteSection
        studentId={id}
        studentHasAccount={Boolean(student.userId)}
      />

      <TelegramLinkSection studentId={id} parents={parents} />

      <FreezeSection
        studentId={id}
        canManage={sessionUser.role !== "TEACHER"}
        freezes={freezes.map((f) => ({
          id: f.id,
          startDate: f.startDate.toISOString(),
          endDate: f.endDate.toISOString(),
        }))}
      />

      <ExamTrackerSection
        studentId={id}
        initialGoals={examGoals || []}
        initialResults={mappedExamResults || []}
      />
    </div>
  );
}
