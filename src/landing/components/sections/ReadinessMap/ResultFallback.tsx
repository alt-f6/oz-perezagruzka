"use client";

import { motion, useReducedMotion } from "framer-motion";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import { ContactForm } from "./ContactForm";

interface ResultFallbackProps {
  leadId: string;
  message: string;
}

export function ResultFallback({ leadId, message }: ResultFallbackProps) {
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
          <div className="mt-6">
            <ContactForm leadId={leadId} ctaLabel="Отправить WhatsApp" />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
