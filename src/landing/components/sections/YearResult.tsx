"use client";

import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";

const RESULTS = [
    "Ребёнок садится за учёбу сам — без ежедневных напоминаний, нервов и скандалов.",
    "Спокойно и уверенно сдаёт ОГЭ по всем выбранным предметам без ночной зубрежки.",
    "Осваивает реальные навыки работы с ИИ, которые помогают в учёбе и останутся с ним надолго.",
    "Вы всегда в курсе успехов: понятные отчёты каждые 2 недели, честные пробники и поддержка на связи.",
];

const RESULT_STAT = {
  text: "80% наших учеников получили желаемый балл на ОГЭ в 2025 году.",
  footnote: "По внутренней статистике центра за 2025 учебный год, на основании опроса выпускников.",
};

export default function YearResult() {
  const prefersReducedMotion = useReducedMotion();

  const itemVariants = fadeInUp(prefersReducedMotion, 40);

  return (
    <Section className="bg-gradient-to-br from-brand-900 to-ink-900">
      <Atmosphere variant="brand" intensity="premium" />
      <div
        className="absolute bottom-0 right-0 w-96 h-96 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(247,168,12,0.08) 0%, transparent 70%)'
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-bold tracking-tight text-white text-balance">
            Результат за год
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/70">
            Не только сданный ОГЭ — а то, что остаётся с ребёнком дальше.
          </p>
        </div>

        <motion.ul
          variants={staggerContainer(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="space-y-4"
        >
          {RESULTS.map((item) => (
            <motion.li
              key={item}
              variants={itemVariants}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.01, y: -3 }}
              className="flex items-start gap-3.5 rounded-2xl border border-white/40 bg-white/70 p-5 shadow-card backdrop-blur-xl transition-shadow duration-300 hover:shadow-card-hover"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-100 text-accent-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-sm leading-relaxed text-ink-700 sm:text-base">{item}</span>
            </motion.li>
          ))}
          <motion.li
            variants={itemVariants}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.01, y: -3 }}
            className="flex flex-col gap-1 rounded-2xl border border-white/40 bg-white/70 p-5 shadow-card backdrop-blur-xl transition-shadow duration-300 hover:shadow-card-hover"
          >
            <div className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-100 text-accent-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-sm leading-relaxed text-ink-700 sm:text-base">{RESULT_STAT.text}</span>
            </div>
            <p className="pl-9 text-xs text-ink-400">{RESULT_STAT.footnote}</p>
          </motion.li>
        </motion.ul>
      </div>
    </Section>
  );
}
