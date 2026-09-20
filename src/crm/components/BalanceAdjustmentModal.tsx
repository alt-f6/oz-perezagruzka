"use client";

import { useState, type FormEvent } from "react";
import { Wallet } from "lucide-react";
import { Modal } from "@/crm/components/Modal";
import { useToast } from "@/crm/components/ToastProvider";
import type { ActionResult } from "@/crm/lib/types";

interface BalanceAdjustmentModalProps {
  studentId: string;
  updateBalance: (studentId: string, amount: number, description: string) => Promise<ActionResult>;
  triggerLabel?: string;
  triggerClassName?: string;
  iconOnly?: boolean;
}

export function BalanceAdjustmentModal({
  studentId,
  updateBalance,
  triggerLabel = "Скорректировать баланс",
  triggerClassName,
  iconOnly = false,
}: BalanceAdjustmentModalProps) {
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get("amount"));
    const description = String(formData.get("description") ?? "");

    setBusy(true);
    try {
      const result = await updateBalance(studentId, amount, description);
      if (result?.error) {
        showToast(result.error, "error");
        return;
      }
      setOpen(false);
      showToast("Транзакция успешно зафиксирована");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={triggerLabel}
        className={
          triggerClassName ??
          (iconOnly
            ? "icon-btn h-8 w-8"
            : "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 active:scale-[0.98]")
        }
      >
        <Wallet size={iconOnly ? 16 : 15} />
        {!iconOnly && triggerLabel}
      </button>

      <Modal open={open} title="Внести операцию (Ledger)" onClose={() => setOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label htmlFor="balance-amount" className="label">
              Сумма операции (₽) *
            </label>
            <input
              id="balance-amount"
              name="amount"
              type="number"
              placeholder="Пример: 5000 для прихода или -600 для списания"
              className="input"
              disabled={busy}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Положительное число — пополнение баланса, отрицательное — ручное списание.
            </p>
          </div>

          <div>
            <label htmlFor="balance-description" className="label">
              Основание / Комментарий
            </label>
            <input
              id="balance-description"
              name="description"
              placeholder="Оплата абонемента на октябрь / Корректировка"
              className="input"
              disabled={busy}
            />
            <p className="mt-1 text-xs text-slate-500">
              Для списания (отрицательная сумма) основание обязательно — минимум 3 символа.
            </p>
          </div>

          <button type="submit" disabled={busy} className="btn-primary mt-2 w-full">
            {busy ? "Проведение..." : "Провести транзакцию"}
          </button>
        </form>
      </Modal>
    </>
  );
}
