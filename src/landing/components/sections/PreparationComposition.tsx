"use client";

import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";
import { useExam } from "@/landing/lib/exam-context";
import { PREPARATION_AI_SKILL } from "@/landing/lib/exam-content";

const STATIC_POINTS = [
  "Мини-группа",
  "ИИ-репетитор на связи 24/7",
  "Короткие видео вместо часовых лекций",
  "Отчёт родителям каждые 2 недели",
];

export default function PreparationComposition() {
  const prefersReducedMotion = useReducedMotion();
  const { exam } = useExam();
  const itemVariants = fadeInUp(prefersReducedMotion);
  const points = [...STATIC_POINTS, PREPARATION_AI_SKILL[exam]];

  return (
    <Section tone="white" className="border-y border-ink-100">
      <div className="relative mx-auto max-w-3xl px-6">
        <div className="mb-10 text-center">
          <h2 className="font-bold tracking-tight text-ink-900 text-balance">
            Из чего состоит подготовка
          </h2>
        </div>

        <motion.ul
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="space-y-3"
        >
          {points.map((point) => (
            <motion.li
              key={point}
              variants={itemVariants}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex items-start gap-3.5 rounded-2xl border border-ink-100 bg-white/80 p-4 shadow-sm shadow-ink-900/5"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-sm font-medium leading-relaxed text-ink-700">{point}</span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </Section>
  );
}
