"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Modal } from "@/crm/components/Modal";
import { useToast } from "@/crm/components/ToastProvider";
import { paymentAmountSchema, type PaymentAmountValues } from "@/crm/lib/schemas";
import type { ActionResult } from "@/crm/lib/types";

interface PaymentModalProps {
  studentId: string;
  triggerLabel?: string;
  triggerClassName?: string;
  createPaymentSession: (
    studentId: string,
    values: unknown,
  ) => Promise<ActionResult & { confirmationUrl?: string }>;
}

export function PaymentModal({
  studentId,
  triggerLabel = "Пополнить баланс",
  triggerClassName,
  createPaymentSession,
}: PaymentModalProps) {
  const showToast = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.input<typeof paymentAmountSchema>, unknown, PaymentAmountValues>({
    resolver: zodResolver(paymentAmountSchema),
  });

  const onSubmit = async (values: PaymentAmountValues) => {
    const result = await createPaymentSession(studentId, values);
    if (result?.error) {
      showToast(result.error, "error");
      return;
    }
    if (result.confirmationUrl) {
      window.location.assign(result.confirmationUrl);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ??
          "inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-700 active:scale-[0.98]"
        }
      >
        {triggerLabel}
      </button>

      <Modal open={isOpen} title="Пополнение баланса" onClose={() => setIsOpen(false)}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Сумма, ₽</label>
            <input
              type="number"
              step="0.01"
              min="1"
              {...form.register("amount")}
              disabled={form.formState.isSubmitting}
              className="input"
              placeholder="1000"
            />
            {form.formState.errors.amount && (
              <p className="field-error">
                {form.formState.errors.amount.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
          >
            {form.formState.isSubmitting ? "Переход к оплате..." : "Перейти к оплате"}
          </button>
        </form>
      </Modal>
    </>
  );
}
