"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/crm/components/ToastProvider";
import { simulateMockPaymentCanceled, simulateMockPaymentSucceeded } from "./actions";
import type { PaymentIntentStatus } from "@prisma/client";

export function MockCheckoutClient({
  intentId,
  studentName,
  amount,
  status,
}: {
  intentId: string;
  studentName: string;
  amount: number;
  status: PaymentIntentStatus;
}) {
  const showToast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handle = async (action: (id: string) => Promise<{ error?: string }>) => {
    setBusy(true);
    try {
      const result = await action(intentId);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      showToast("Готово");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-20 max-w-md space-y-4 rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700">
        Тестовый чекаут (mock-режим) — реальных денег нет, это только для локальной разработки.
      </div>

      <h1 className="text-lg font-bold text-accent">Оплата для {studentName}</h1>
      <p className="text-3xl font-black text-accent">{amount.toLocaleString("ru-RU")} ₽</p>

      {status !== "PENDING" ? (
        <p className="text-sm text-accent/60">
          Платёж уже обработан ({status === "SUCCEEDED" ? "успешно" : "отменён"}).
        </p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => handle(simulateMockPaymentSucceeded)}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            Симулировать успешную оплату
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => handle(simulateMockPaymentCanceled)}
            className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-medium text-accent transition hover:bg-base/50 disabled:opacity-60"
          >
            Симулировать отмену
          </button>
        </div>
      )}
    </div>
  );
}
