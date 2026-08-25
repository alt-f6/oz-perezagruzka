"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Card from "@/landing/components/ui/Card";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";
import { useExam } from "@/landing/lib/exam-context";
import { PAIN_POINTS_TITLE } from "@/landing/lib/exam-content";

const PAIN_POINTS_PHOTO = "photo_2026-08-23_11-25-16.jpg";

const PAIRS = [
  { before: "Репетитора не контролирует никто.", after: "Педагогов контролируем мы сами." },
  { before: "О проблеме узнаёте через месяцы.", after: "Отчёт каждые 2 недели." },
  { before: "Ребёнок — один из сотни в потоке.", after: "Мини-группа, а не поток." },
];

export default function PainPoints() {
  const prefersReducedMotion = useReducedMotion();
  const { exam } = useExam();

  const cardVariants = fadeInUp(prefersReducedMotion);

  return (
    <Section tone="brand-wash" className="border-y border-ink-100">
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="mb-10 text-center font-bold tracking-tight text-ink-900 text-balance">
          {PAIN_POINTS_TITLE[exam]}
        </h2>

        <div className="relative mx-auto mb-14 aspect-[16/9] max-w-4xl overflow-hidden rounded-3xl border-[3px] border-accent-500 shadow-xl shadow-ink-900/10">
          <Image
            src={`/photos/${PAIN_POINTS_PHOTO}`}
            alt="Ученики в панике перед экзаменом у доски"
            fill
            sizes="(min-width: 1024px) 896px, 90vw"
            className="object-cover"
          />
        </div>

        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 md:grid-cols-3"
        >
          {PAIRS.map((pair) => (
            <motion.div
              key={pair.before}
              variants={cardVariants}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
              whileHover={prefersReducedMotion ? undefined : { y: -6 }}
            >
              <Card
                tint="premium"
                rounded="3xl"
                className="group relative flex h-full flex-col gap-4 transition-all duration-300 hover:border-brand-300 hover:shadow-2xl hover:shadow-brand-900/10"
              >
                <p className="text-base italic leading-relaxed text-ink-400 line-through decoration-ink-300">
                  {pair.before}
                </p>
                <div className="flex items-center gap-2 text-brand-500">
                  <ArrowRight className="h-4 w-4" aria-hidden />
                  <span className="text-xs font-bold uppercase tracking-wider">Стало</span>
                </div>
                <p className="text-lg font-bold leading-relaxed text-ink-900">{pair.after}</p>
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
