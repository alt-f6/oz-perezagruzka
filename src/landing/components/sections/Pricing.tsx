"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import Section from "@/landing/components/ui/Section";
import { fadeInUp } from "@/landing/components/ui/motion";
import { useExam } from "@/landing/lib/exam-context";
import { PRICING_TIERS, type PricingTierContent } from "@/landing/lib/exam-content";
import { reachGoal } from "@/landing/lib/analytics";

const FEATURES = [
  "Живые занятия в мини-группах",
  "ИИ-репетитор на связи 24/7",
  "Отчёт родителям каждые 2 недели",
  "Практика на реальных пробниках",
  "Мастер-класс по психологической подготовке",
  "Чат поддержки и проверки заданий",
];

const PRICING_FOOTER = "✓ Целевой балл фиксируется в договоре — не выводим на него, возвращаем стоимость";
const PRICING_BUTTON_LABEL = "Записаться на бесплатный разбор";

export default function Pricing() {
  const prefersReducedMotion = useReducedMotion();
  const { exam } = useExam();
  const tiers = PRICING_TIERS[exam];
  const [selectedSubjects, setSelectedSubjects] = useState<1 | 2 | 3>(3);
  const selectedTier: PricingTierContent =
    tiers.find((tier) => tier.subjects === selectedSubjects) ?? tiers[tiers.length - 1];
  const cardVariants = fadeInUp(prefersReducedMotion);

  return (
    <Section id="pricing" tone="brand-wash" paddingOverride="py-16 md:py-24">
      <Atmosphere variant="accent" />

      <div className="relative mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-bold tracking-tight text-ink-900">Тарифы</h2>
          <p className="mx-auto mt-3.5 max-w-xl text-lg text-ink-600">
            Прозрачная цена без скрытых платежей — набор поддержки одинаковый на любом тарифе.
          </p>
        </div>

        <motion.div
          variants={cardVariants}
          initial={prefersReducedMotion ? undefined : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="relative overflow-hidden rounded-[36px] border border-brand-100/80 bg-white/90 p-8 shadow-xl shadow-ink-900/5 backdrop-blur-md md:p-10"
        >
          <ul className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3.5 text-sm font-medium text-ink-700 md:text-base">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <div
            role="radiogroup"
            aria-label="Количество предметов"
            className="mx-auto mt-10 flex max-w-4xl items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-slate-100/90 p-3 shadow-lg sm:p-4"
          >
            {tiers.map((tier) => {
              const selected = tier.subjects === selectedSubjects;
              return (
                <button
                  key={tier.subjects}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedSubjects(tier.subjects)}
                  className={`relative flex min-h-[72px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-xl font-black transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-[84px] sm:text-2xl ${
                    selected
                      ? "bg-[#0055FF] text-white shadow-sm shadow-brand-900/20"
                      : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  {tier.isBestValue && (
                    <span className="rounded-full bg-[#AAEE00] px-3.5 py-1 text-xs font-black text-ink-900 shadow-sm sm:text-sm">
                      ЛУЧШИЙ ВЫБОР
                    </span>
                  )}
                  <span>{tier.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 border-t border-ink-100 pt-8 text-center">
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="font-mono text-4xl font-extrabold tracking-tight text-ink-900">
                {selectedTier.price}
              </span>
              <span className="text-sm font-semibold text-ink-600">/ мес</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-brand-700">{selectedTier.pricePerSubject}</p>

            <p className="mx-auto mt-6 max-w-sm rounded-xl bg-brand-50 px-4 py-3 text-xs font-semibold text-brand-700">
              {PRICING_FOOTER}
            </p>

            <a
              href="#readiness-map"
              onClick={() => reachGoal("cta_analysis_click")}
              className="mt-8 flex min-h-[60px] items-center justify-center rounded-2xl bg-brand-600 px-6 text-center text-lg font-bold text-white shadow-md shadow-brand-900/20 transition-all duration-300 hover:-translate-y-1 hover:bg-brand-700 hover:shadow-lg active:scale-98"
            >
              {PRICING_BUTTON_LABEL}
            </a>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
