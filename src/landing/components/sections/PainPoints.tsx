"use client";

import { Quote } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Card from "@/landing/components/ui/Card";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";

const PAINS = [
  {
    text: "«Деньги потрачу — а он всё равно не сдаст ОГЭ»",
    author: "Елена",
    role: "мама ученика 8 класса",
    avatarClass: "bg-rose-100 text-rose-700",
  },
  {
    text: "«Не могу заставить его сесть за учёбу, только скандалы»",
    author: "Ирина",
    role: "мама ученика 9 класса",
    avatarClass: "bg-brand-100 text-brand-700",
  },
  {
    text: "«Сдаст ОГЭ — а дальше что? Не выброшенные ли это деньги?»",
    author: "Гузель",
    role: "мама ученика 9 класса",
    avatarClass: "bg-accent-100 text-accent-800",
  },
];

export default function PainPoints() {
  const prefersReducedMotion = useReducedMotion();

  const cardVariants = fadeInUp(prefersReducedMotion);

  return (
    <Section tone="brand-wash" className="border-y border-ink-100">

      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="mb-14 text-center font-bold tracking-tight text-ink-900 text-balance">
          «Деньги потрачу — а он всё равно не сдаст»
        </h2>

        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 md:grid-cols-3"
        >
          {PAINS.map((item) => (
            <motion.div
              key={item.text}
              variants={cardVariants}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
              whileHover={prefersReducedMotion ? undefined : { y: -6 }}
            >
              <Card
                tint="premium"
                rounded="3xl"
                className="group relative transition-all duration-300 hover:border-brand-300 hover:shadow-2xl hover:shadow-brand-900/10"
              >
                <Quote
                  aria-hidden
                  className="mb-4 h-7 w-7 text-brand-300"
                  strokeWidth={2.5}
                />
                <p className="mb-6 max-w-prose text-lg italic leading-relaxed text-ink-700">
                  {item.text}
                </p>
                <div className="flex items-center gap-3 border-t border-ink-100 pt-4">
                  <div
                    aria-hidden
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${item.avatarClass}`}
                  >
                    {item.author.charAt(0)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2">
                    <p className="text-sm font-semibold text-ink-800">{item.author}</p>
                    <span aria-hidden className="text-ink-300">·</span>
                    <p className="text-xs text-ink-400">{item.role}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="relative mt-16 overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-600 to-brand-900 p-10 text-center text-white shadow-2xl shadow-brand-900/25 md:p-14">
          <div className="pointer-events-none absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-accent-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-brand-300/15 blur-3xl" />

          <p className="relative z-10 text-2xl font-bold tracking-tight md:text-3xl text-white">
            Дело не в том, что ваш ребёнок — слабый ученик.{" "}
            <span className="text-accent-300">Дело в формате.</span>
          </p>
          <p className="relative z-10 mx-auto mt-3 max-w-xl text-lg font-light leading-relaxed text-brand-100/90">
            Часовые лекции — это прошлый век. Ребёнка нужно вовлекать интерактивно.
          </p>
        </div>
      </div>
    </Section>
  );
}
