"use client";

import { Wallet } from "lucide-react";
import { PaymentModal } from "@/crm/components/PaymentModal";
import { PortalTopBar } from "@/crm/components/PortalTopBar";
import { ChildSwitcher } from "./ChildSwitcher";
import { createParentPaymentSession } from "./payment-actions";
import type { ChildOption } from "./page";

interface TransactionRow {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  createdAt: string;
}

interface GroupRow {
  id: string;
  name: string;
  pricePerLesson: number;
}

export function ParentDashboardClient({
  parentName,
  childStudents,
  activeChildId,
  totalBalance,
  transactions,
  groups,
}: {
  parentName: string;
  childStudents: ChildOption[];
  activeChildId: string;
  totalBalance: number;
  transactions: TransactionRow[];
  groups: GroupRow[];
}) {
  const activeChild = childStudents.find((c) => c.id === activeChildId);

  return (
    <div className="space-y-4">
      <PortalTopBar
        title={`Здравствуйте, ${parentName}!`}
        subtitle="Личный кабинет родителя"
      />

      <ChildSwitcher childStudents={childStudents} activeChildId={activeChildId} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-accent/50">
            <Wallet size={16} />
            Баланс {activeChild?.fullName}
          </h2>
          <p
            className={`mt-2 text-3xl font-black ${
              totalBalance < 0 ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {totalBalance.toLocaleString("ru-RU")} ₽
          </p>
          <div className="mt-4">
            <PaymentModal
              studentId={activeChildId}
              createPaymentSession={createParentPaymentSession}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-accent/50">
            Активные группы
          </h2>
          {groups.length > 0 ? (
            <div className="mt-3 space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between rounded-xl bg-base/50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-accent">{group.name}</span>
                  <span className="text-accent/60">
                    {Number(group.pricePerLesson).toLocaleString("ru-RU")} ₽/занятие
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-accent/40">Нет активных групп</p>
          )}
        </div>
      </div>

      <PaymentHistory transactions={transactions} />
    </div>
  );
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  PAYMENT: "Оплата",
  LESSON_CHARGE: "Списание за занятие",
  REFUND: "Возврат",
  ADJUSTMENT: "Корректировка",
};

function PaymentHistory({ transactions }: { transactions: TransactionRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-accent/50">
        История платежей
      </h2>
      {transactions.length > 0 ? (
        <div className="mt-3 divide-y divide-border">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <p className="font-medium text-accent">
                  {TRANSACTION_TYPE_LABELS[t.type] ?? t.type}
                </p>
                <p className="text-xs text-accent/50">
                  {new Date(t.createdAt).toLocaleDateString("ru-RU")}
                  {t.description && ` · ${t.description}`}
                </p>
              </div>
              <span
                className={`font-bold ${t.amount < 0 ? "text-red-600" : "text-emerald-600"}`}
              >
                {t.amount > 0 ? "+" : ""}
                {Number(t.amount).toLocaleString("ru-RU")} ₽
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-accent/40">Платежей пока нет</p>
      )}
    </div>
  );
}
