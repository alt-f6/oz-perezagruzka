"use client";

import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Card from "@/landing/components/ui/Card";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";
import { useExam } from "@/landing/lib/exam-context";
import { reachGoal } from "@/landing/lib/analytics";

const METRICS = [
  {
    number: "36–42 балла",
    subtext:
      "Разрыв между проходным на бюджет и на платное — данные Рособрнадзора. Это не пропасть, а дистанция одного учебного года системной подготовки.",
  },
  {
    number: "1 000 000 ₽",
    subtext:
      "Столько стоят четыре года платного бакалавриата по средней цене 2026 года — 250 000 ₽ в год. В Москве и Петербурге от 400 000 ₽ в год, то есть больше полутора миллионов за диплом.",
  },
  {
    number: "56–69 баллов",
    subtext:
      "С таким средним баллом по предмету на бюджет принимают больше 70% региональных вузов. Большинство школьников способны потянуть бюджет — вопрос только в том, начали ли вовремя.",
  },
];

export default function BudgetVsPaidEGE() {
  const { exam } = useExam();
  const prefersReducedMotion = useReducedMotion();
  const cardVariants = fadeInUp(prefersReducedMotion);

  if (exam !== "ege") return null;

  return (
    <Section>
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="mb-10 text-center font-bold tracking-tight text-ink text-balance">
          Это не расходы на репетитора. Это решение о том, как ваш ребёнок проживёт следующие пять
          лет.
        </h2>

        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          {METRICS.map((metric) => (
            <motion.div
              key={metric.number}
              variants={cardVariants}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
            >
              <Card tint="premium" rounded="3xl" className="h-full text-center">
                <p className="text-4xl font-black text-electric">{metric.number}</p>
                <p className="mt-4 text-sm leading-relaxed text-ink-600">{metric.subtext}</p>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="mx-auto mt-12 max-w-3xl text-center">
          <p className="text-base leading-relaxed text-ink-700 md:text-lg">
            От балла зависит город, в котором ребёнок проживёт пять лет: захолустье или мегаполис,
            где есть работа и среда. Зависит, будет ли он учиться на профессии, которая его
            зажигает, или пойдёт туда, куда прошёл по баллам. И зависит, заплатит ли семья за это
            миллион.
          </p>
          <p className="mt-4 text-base leading-relaxed text-ink-700 md:text-lg">
            Всё это решается не в мае, когда выбирать уже не из чего.
          </p>

          <a
            href="#readiness-map"
            onClick={() => reachGoal("cta_ege_block_click")}
            className="mt-8 inline-flex min-h-[60px] items-center justify-center rounded-2xl bg-brand-600 px-8 text-center text-lg font-bold text-white shadow-md shadow-brand-900/20 transition-all duration-300 hover:-translate-y-1 hover:bg-brand-700 hover:shadow-lg active:scale-98"
          >
            Записаться на бесплатный разбор
          </a>

          <p className="mx-auto mt-4 max-w-xl text-xs text-slate-500 sm:text-sm">
            Источники: Рособрнадзор, Минобрнауки, «Табитуриент», 2026 год.
          </p>
        </div>
      </div>
    </Section>
  );
}
