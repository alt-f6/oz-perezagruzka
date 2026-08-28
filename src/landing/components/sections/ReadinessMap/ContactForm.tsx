"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { attachLeadContact } from "@/landing/actions/lead";
import { LegalCheckbox } from "@/landing/components/ui/LegalCheckbox";
import { normalizeRussianPhone } from "@/shared/validation/phone";

const contactFormSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "Введите номер телефона")
    .refine((val) => normalizeRussianPhone(val) !== null, {
      message: "Введите корректный номер телефона (+7 или 8, 10 цифр)",
    }),
  honeypot: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

interface ContactFormProps {
  leadId: string;
  ctaLabel: string;
}

export function ContactForm({ leadId, ctaLabel }: ContactFormProps) {
  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [formRenderedAt, setFormRenderedAt] = useState<number | null>(null);

  useEffect(() => {
    setFormRenderedAt(Date.now());
  }, []);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { phone: "", honeypot: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!consent) {
      setConsentError(true);
      return;
    }
    setState("submitting");
    setServerError(null);
    const result = await attachLeadContact({
      leadId,
      phone: values.phone,
      consent,
      honeypot: values.honeypot,
      formRenderedAt: formRenderedAt ?? undefined,
    });
    if (result.status === "ok") {
      setState("done");
    } else {
      setState("idle");
      setServerError(result.message);
    }
  });

  const phoneRegister = form.register("phone", {
    onChange: (e) => {
      const rawValue = e.target.value;
      const digits = rawValue.replace(/\D/g, "");
      
      let formatted = "";
      if (digits.length > 0) {
        formatted = "+7";
        if (digits.length > 1) {
          const startIdx = digits[0] === "7" || digits[0] === "8" ? 1 : 0;
          const remaining = digits.substring(startIdx);
          
          if (remaining.length > 0) {
            formatted += " (" + remaining.substring(0, 3);
          }
          if (remaining.length >= 4) {
            formatted += ") " + remaining.substring(3, 6);
          }
          if (remaining.length >= 7) {
            formatted += "-" + remaining.substring(6, 8);
          }
          if (remaining.length >= 9) {
            formatted += "-" + remaining.substring(8, 10);
          }
        }
      }
      form.setValue("phone", formatted, { shouldValidate: true });
    }
  });

  if (state === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center"
      >
        <p className="font-extrabold text-brand-700 text-sm md:text-base">
          ✓ Спасибо! Мы свяжемся с вами в WhatsApp в течение рабочего дня.
        </p>
      </motion.div>
    );
  }

  const hasError = !!form.formState.errors.phone || !!serverError;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-px w-px overflow-hidden opacity-0"
        {...form.register("honeypot")}
      />
      <div className="flex flex-col gap-3 w-full sm:flex-row sm:items-start">
        <div className="flex-1 min-h-[56px] flex flex-col">
          <input
            {...phoneRegister}
            placeholder="+7 (999) 123-45-67"
            aria-label="Номер телефона"
            inputMode="tel"
            className={`min-h-[56px] w-full rounded-2xl border px-5 py-4 bg-white text-ink-900 placeholder:text-ink-400 outline-none transition-all duration-200 focus:ring-4 ${
              hasError
                ? "border-rose-400 bg-rose-50 focus:border-rose-500 focus:ring-rose-200"
                : "border-ink-200 focus:border-brand-400 focus:ring-brand-100"
            }`}
          />

          <div className="mt-1.5 min-h-[18px] text-xs font-medium text-rose-500">
            <AnimatePresence mode="wait">
              {form.formState.errors.phone ? (
                <motion.p
                  key="phone-error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  {form.formState.errors.phone.message}
                </motion.p>
              ) : serverError ? (
                <motion.p
                  key="server-error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  {serverError}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <button
          type="submit"
          disabled={state === "submitting"}
          className="min-h-[56px] shrink-0 rounded-2xl bg-brand-600 px-8 py-4 text-base font-extrabold text-white shadow-md shadow-brand-600/25 transition-all duration-150 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100 whitespace-nowrap"
        >
        {state === "submitting" ? (
          <span className="flex items-center gap-2 justify-center">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Отправляем...
          </span>
        ) : (
          ctaLabel
        )}
        </button>
      </div>

      <LegalCheckbox
        checked={consent}
        onChange={(value) => {
          setConsent(value);
          if (value) setConsentError(false);
        }}
        error={consentError}
      />
    </form>
  );
}