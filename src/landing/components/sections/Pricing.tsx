"use client";

import { motion, useReducedMotion } from "framer-motion";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import Section from "@/landing/components/ui/Section";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";
import { useExam } from "@/landing/lib/exam-context";
import { PRICING_PLANS, type PricingPlanContent } from "@/landing/lib/exam-content";

const FEATURES = [
  "Живые занятия до 10 человек в группе",
  "Доступ к ИИ-репетитору 24/7",
  "Отчёты о прогрессе каждые 2 недели",
  "Практика на реальных пробниках",
  "Мастер-класс по работе с нейросетями",
  "Чат поддержки для родителей",
];

const PRICING_FOOTER = "✓ Целевой балл фиксируется в договоре — не выводим на него, возвращаем стоимость";
const PRICING_BUTTON_LABEL = "Записаться на бесплатный разбор";

export default function Pricing() {
  const prefersReducedMotion = useReducedMotion();
  const { exam } = useExam();
  const cardVariants = fadeInUp(prefersReducedMotion);
  const plans = PRICING_PLANS[exam];

  return (
    <Section id="pricing" tone="brand-wash" paddingOverride="py-16 md:py-24">
      <Atmosphere variant="accent" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="font-bold tracking-tight text-ink-900">
            Тарифы и что в них входит
          </h2>
          <p className="mx-auto mt-3.5 max-w-xl text-lg text-ink-600">
            Прозрачная цена без скрытых платежей — в каждом тарифе одинаковый набор поддержки.
          </p>
        </div>

        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto"
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.id}
              variants={cardVariants}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="h-full"
            >
              <PricingCard plan={plan} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

function PricingCard({ plan }: { plan: PricingPlanContent }) {
  const content = (
    <>
      {plan.isBestValue && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-500 to-accent-400 px-5 py-1.5 text-xs font-extrabold uppercase tracking-wider text-ink-900 shadow-md shadow-accent-500/20">
          Лучший выбор
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-bold tracking-tight text-ink-900">{plan.name}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{plan.description}</p>
      </div>

      <div className="my-6 flex items-baseline gap-1.5 border-b border-ink-100 pb-6">
        <span className="text-4xl font-extrabold tracking-tight text-ink-900">{plan.price}</span>
        <span className="text-sm font-semibold text-ink-600">/ мес</span>
      </div>

      <ul className="flex-1 space-y-4">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-3.5 text-sm font-medium text-ink-700">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
              plan.isBestValue ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-600"
            }`}>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <a
        href="#readiness-map"
        className={`mt-10 block rounded-2xl py-4.5 text-center font-bold shadow-md transition-all duration-300 hover:-translate-y-1 active:scale-98 ${
          plan.isBestValue
            ? "bg-gradient-to-r from-accent-400 to-accent-500 text-ink-900 font-extrabold shadow-accent-500/20 hover:shadow-lg hover:shadow-accent-500/35"
            : "bg-brand-600 text-white shadow-brand-900/20 hover:bg-brand-700 hover:shadow-lg"
        }`}
      >
        {PRICING_BUTTON_LABEL}
      </a>

      <p className="mt-4 text-center text-xs font-semibold text-ink-500">
        {PRICING_FOOTER}
      </p>
    </>
  );

  if (plan.isBestValue) {
    return (
      <div className="relative h-full rounded-[36px] bg-gradient-to-b from-brand-500 to-accent-400 p-[1.5px] shadow-[var(--shadow-brand-glow)] transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[var(--shadow-brand-glow-hover)]">
        <div className="relative flex h-full flex-col rounded-[34px] bg-white/90 border border-brand-100 p-8 pt-12 shadow-2xl backdrop-blur-md md:p-10 md:pt-14">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col rounded-[36px] border border-purple-100/80 bg-white/80 p-8 shadow-xl shadow-purple-950/5 backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-2 hover:border-brand-300 hover:shadow-2xl hover:shadow-brand-900/10 md:p-10">
      {content}
    </div>
  );
}
