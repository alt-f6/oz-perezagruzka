"use client";

import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Card from "@/landing/components/ui/Card";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";
import { useExam } from "@/landing/lib/exam-context";
import { reachGoal } from "@/landing/lib/analytics";
import { PRICING_TIERS, TRIAL_LESSON_CTA } from "@/landing/lib/exam-content";

const METRICS = [
  {
    number: "36–42 балла",
    subtext:
      "Примерно столько отделяет проходной балл на платное от проходного на бюджет, если смотреть на данные Рособрнадзора. Обычно это один учебный год спокойной, системной подготовки.",
  },
  {
    number: "1 000 000 ₽",
    subtext:
      "Миллион рублей в среднем переплачивают родители, если ребёнок не вышел на проходной балл: четыре года платного бакалавриата при средней цене 2026 года около 250 000 ₽ в год. В Москве и Петербурге год стоит от 400 000 ₽, и за диплом набегает больше полутора миллионов.",
  },
  {
    number: "56–69 баллов",
    subtext:
      "С таким средним баллом по предмету на бюджет принимают больше 70% региональных вузов. Большинство школьников способны потянуть бюджет — вопрос только в том, начали ли вовремя.",
  },
];

// Sept-May: the stretch a school year of exam prep actually covers.
const PREP_MONTHS = 9;
const PAID_DEGREE_TOTAL = "от 1 000 000 ₽";

function rubles(price: string): number {
  return Number(price.replace(/\D/g, ""));
}

// Same "13 000 ₽" shape as the tariff strings (plain space groups).
function formatRubles(value: number): string {
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₽`;
}

// Derived from the live EGE tariffs so the comparison can never drift from
// the prices shown in the Pricing block.
const EGE_TIERS = PRICING_TIERS.ege;
const PREP_YEAR_FROM = formatRubles(rubles(EGE_TIERS[0].price) * PREP_MONTHS);
const PREP_YEAR_MAX_TIER = formatRubles(rubles(EGE_TIERS[EGE_TIERS.length - 1].price) * PREP_MONTHS);

export default function BudgetVsPaidEGE() {
  const { exam } = useExam();
  const prefersReducedMotion = useReducedMotion();
  const cardVariants = fadeInUp(prefersReducedMotion);

  if (exam !== "ege") return null;

  return (
    <Section>
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="mb-10 text-center font-bold tracking-tight text-ink text-balance">
          Сейчас вы принимаете решение о том, как ваш ребёнок проживёт следующие пять лет — обратите
          внимание на эти цифры
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

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
          <Card tint="premium" rounded="3xl" className="h-full text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-brand-700">
              Год подготовки в «Перезагрузке»
            </p>
            <p className="mt-3 text-3xl font-black text-electric md:text-4xl">от {PREP_YEAR_FROM}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              Один предмет с сентября по май. Три предмета — {PREP_YEAR_MAX_TIER} за тот же год.
            </p>
          </Card>
          <Card tint="premium" rounded="3xl" className="h-full text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-ink-500">
              Платный бакалавриат
            </p>
            <p className="mt-3 text-3xl font-black text-ink-900 md:text-4xl">{PAID_DEGREE_TOTAL}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              Четыре года обучения, если на бюджет не хватило нескольких баллов.
            </p>
          </Card>
        </div>

        <div className="mx-auto mt-12 max-w-3xl text-center">
          <p className="text-base leading-relaxed text-ink-700 md:text-lg">
            От балла зависит город, в котором ребёнок проживёт пять лет: захолустье или мегаполис,
            где есть работа и среда. Зависит, будет ли он учиться на профессии, которая его
            зажигает, или пойдёт туда, куда прошёл по баллам. И зависит, заплатит ли семья за это
            миллион.
          </p>
          <p className="mt-4 text-base leading-relaxed text-ink-700 md:text-lg">
            И решается всё это задолго до мая, пока ещё есть из чего выбирать.
          </p>

          <a
            href="#readiness-map"
            onClick={() => reachGoal("cta_ege_block_click")}
            className="mt-8 inline-flex min-h-[60px] items-center justify-center rounded-2xl bg-brand-600 px-8 text-center text-lg font-bold text-white shadow-md shadow-brand-900/20 transition-all duration-300 hover:-translate-y-1 hover:bg-brand-700 hover:shadow-lg active:scale-98"
          >
            {TRIAL_LESSON_CTA}
          </a>

          <p className="mx-auto mt-4 max-w-xl text-xs text-slate-500 sm:text-sm">
            Источники: Рособрнадзор, Минобрнауки, «Табитуриент», 2026 год.
          </p>
        </div>
      </div>
    </Section>
  );
}
