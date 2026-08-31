"use client";

import { motion, useReducedMotion } from "framer-motion";

import Section from "@/landing/components/ui/Section";
import { reachGoal } from "@/landing/lib/analytics";

export default function FinalCTA() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <Section paddingOverride="py-16 md:py-20">
      <div className="relative mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-brand-900 via-brand-900 to-ink-900 px-8 py-16 text-center shadow-2xl shadow-brand-900/30 sm:px-12 md:py-20"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
            <div className="motion-safe:animate-blob-float absolute -left-24 -top-28 h-96 w-96 rounded-full bg-brand-400/30 blur-[100px]" />
            <div className="motion-safe:animate-blob-float-slow absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-accent-400/25 blur-[100px]" />
            <div className="motion-safe:animate-blob-float absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-[90px]" />
            <div className="absolute inset-0 bg-[image:var(--gradient-white-glow)]" />
          </div>

          <div className="relative z-10 mx-auto max-w-2xl">
            <span className="inline-block rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-accent-300 backdrop-blur-sm">
              Бесплатно и без обязательств
            </span>

            <h2 className="mt-5 font-bold tracking-tight text-white text-balance">
              Начните с бесплатного разбора —<br className="hidden sm:block" /> а решение примете позже
            </h2>

            <div className="mt-9 flex flex-col items-center justify-center gap-4">
              <motion.a
                href="#readiness-map"
                onClick={() => reachGoal("cta_analysis_click")}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 90, damping: 18 }}
                className="group relative flex min-h-[60px] items-center justify-center overflow-hidden rounded-xl bg-brand-600 px-10 text-lg font-bold text-white shadow-lg shadow-brand-600/25 transition-all duration-300 hover:bg-brand-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900"
              >
                Записаться на бесплатный разбор
              </motion.a>
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
