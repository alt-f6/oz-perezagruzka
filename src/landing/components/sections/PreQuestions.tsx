"use client";

import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Card from "@/landing/components/ui/Card";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";

const QUESTIONS = [
  "Кто контролирует педагога?",
  "Как часто отчёт о прогрессе?",
  "Учат решать незнакомые задачи или заучивать ответы?",
  "Что будет, если формат не подойдёт через месяц?",
];

export default function PreQuestions() {
  const prefersReducedMotion = useReducedMotion();
  const itemVariants = fadeInUp(prefersReducedMotion);

  return (
    <Section tone="brand-wash">
      <div className="relative mx-auto max-w-3xl px-6">
        <div className="mb-10 text-center">
          <h2 className="font-bold tracking-tight text-ink-900 text-balance">
            4 вопроса перед оплатой
          </h2>
        </div>

        <motion.ul
          variants={staggerContainer(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {QUESTIONS.map((question, i) => (
            <motion.li
              key={question}
              variants={itemVariants}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Card tint="glass" className="flex h-full items-start gap-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {i + 1}
                </span>
                <span className="font-semibold leading-relaxed text-ink-900">{question}</span>
              </Card>
            </motion.li>
          ))}
        </motion.ul>

        <p className="mt-8 text-center text-sm font-semibold text-ink-500">
          Пригодится перед разговором с любой школой, не только с нами
        </p>
      </div>
    </Section>
  );
}
