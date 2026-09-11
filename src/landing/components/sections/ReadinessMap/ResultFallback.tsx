"use client";

import { motion, useReducedMotion } from "framer-motion";
import Atmosphere from "@/landing/components/ui/Atmosphere";

interface ResultFallbackProps {
  leadId: string;
  message: string;
  phone: string;
}

export function ResultFallback({ message, phone }: ResultFallbackProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden py-24">
      <Atmosphere variant="mixed" />

      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative mx-auto max-w-lg px-6"
      >
        <div className="rounded-3xl border border-ink-100 bg-white p-8 text-center shadow-xl shadow-ink-900/10">
          <h3 className="text-xl font-bold tracking-tight text-ink-900">Заявка сохранена</h3>
          <p className="mt-3 leading-relaxed text-ink-600">{message}</p>
          <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center">
            <p className="font-extrabold text-brand-700 text-sm md:text-base leading-relaxed">
              ✓ Заявка принята! Ваш номер {phone} зафиксирован. Эксперт подготовит детальный
              разбор и свяжется с вами в течение 15 минут (с 09:00 до 21:00).
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
