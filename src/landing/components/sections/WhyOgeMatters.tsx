"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Card from "@/landing/components/ui/Card";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";
import { useExam } from "@/landing/lib/exam-context";
import { reachGoal } from "@/landing/lib/analytics";

type InnerTab = "grade10" | "college";

const GRADE10_CARDS = [
  {
    title: "Оценка за ОГЭ идёт в аттестат",
    body: "Итоговая отметка по предмету считается из годовой и экзаменационной. Тройка на ОГЭ портит аттестат навсегда — а он ещё пригодится.",
  },
  {
    title: "В профильный 10 класс берут по результатам ОГЭ",
    body: "Индивидуальный отбор идёт именно по профильным предметам. Не прошёл — учится в общем классе, а поступать будет в конкуренции с теми, кто два года шёл по профилю.",
  },
  {
    title: "ОГЭ — первая честная оценка уровня",
    body: "Школьные пятёрки не показывают ничего. Внешний экзамен показывает реальный потенциал ребёнка — и вы принимаете решения по ЕГЭ, опираясь на факт, а не на надежду.",
  },
  {
    title: "После ОГЭ ребёнок понимает, что ему сдавать на ЕГЭ",
    body: "Он уже попробовал предмет в формате экзамена. Выбор перестаёт быть угадыванием, а это самая дорогая ошибка в 11 классе.",
  },
  {
    title: "ЕГЭ строится на той же базе",
    body: "Пробел, который остался в 9 классе, никуда не денется. Он всплывёт в 11, когда времени уже не будет — и закрывать его придётся срочно и дорого.",
  },
  {
    title: "Формат экзамена отрабатывается один раз",
    body: "Бланки, тайминг, давление. Ребёнок, прошедший это в 9 классе спокойно, в 11 не тратит силы на страх.",
  },
];

const COLLEGE_METRICS = [
  {
    number: "62,5%",
    subtext:
      "Столько девятиклассников выбирают колледж. В 2025 году это 1,3 миллиона человек — данные Минпросвещения. Это давно не «запасной вариант», это основной путь.",
  },
  {
    number: "Конкурс по среднему баллу аттестата",
    subtext:
      "ЕГЭ не нужен, смотрят только аттестат — по убыванию балла. А оценка ОГЭ входит в этот аттестат напрямую.",
  },
  {
    number: "4,85",
    subtext:
      "Проходной балл в сильные колледжи на медицину, IT и юриспруденцию. На рабочие специальности берут от 3,0. Разница между этими двумя цифрами — это разница между профессией и «куда взяли».",
  },
  {
    number: "В 1,3–2 раза",
    subtext:
      "Настолько платное обучение в государственном колледже дешевле частного. Но платное есть платное: не прошёл на бюджет — платишь.",
  },
];

const TABS: { value: InnerTab; label: string }[] = [
  { value: "grade10", label: "В 10 класс" },
  { value: "college", label: "В колледж" },
];

export default function WhyOgeMatters() {
  const { exam } = useExam();
  const prefersReducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<InnerTab>("grade10");
  const cardVariants = fadeInUp(prefersReducedMotion);

  if (exam !== "oge") return null;

  return (
    <Section tone="brand-wash">
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="mb-8 text-center font-bold tracking-tight text-ink text-balance">
          ОГЭ решает больше, чем кажется. И для тех, кто идёт в 10 класс, и для тех, кто уходит в
          колледж.
        </h2>

        <div
          role="tablist"
          aria-label="ОГЭ решает больше, чем кажется"
          className="mx-auto mb-10 flex max-w-md items-center gap-2 rounded-2xl border border-slate-200/90 bg-slate-100/95 p-1.5"
        >
          {TABS.map((tab) => {
            const selected = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.value)}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-colors sm:text-base ${
                  selected
                    ? "bg-electric text-white"
                    : "border border-transparent text-ink-600 hover:bg-white/60"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "grade10" ? (
          <motion.div
            variants={staggerContainer(0.1)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 gap-6 md:grid-cols-2"
          >
            {GRADE10_CARDS.map((card) => (
              <motion.div
                key={card.title}
                variants={cardVariants}
                transition={{ type: "spring", stiffness: 90, damping: 18 }}
              >
                <Card tint="premium" rounded="3xl" className="h-full">
                  <p className="font-bold text-ink-900">{card.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{card.body}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div>
            <motion.div
              variants={staggerContainer(0.1)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-1 gap-6 md:grid-cols-2"
            >
              {COLLEGE_METRICS.map((metric) => (
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

            <div className="mx-auto mt-10 max-w-3xl text-center">
              <p className="text-base leading-relaxed text-ink-700 md:text-lg">
                Бюджет в колледже — это тот же бюджет. Те же сэкономленные деньги, та же
                конкуренция и тот же принцип: место достаётся тому, у кого выше балл.
              </p>
              <p className="mt-4 text-base leading-relaxed text-ink-700 md:text-lg">
                Если у вашего ребёнка есть потенциал пройти на бюджет — странно им не
                воспользоваться из-за двух баллов, которых не хватило в июне.
              </p>
            </div>
          </div>
        )}

        <div className="mx-auto mt-12 max-w-3xl text-center">
          <a
            href="#readiness-map"
            onClick={() => reachGoal("cta_oge_block_click")}
            className="inline-flex min-h-[60px] items-center justify-center rounded-2xl bg-brand-600 px-8 text-center text-lg font-bold text-white shadow-md shadow-brand-900/20 transition-all duration-300 hover:-translate-y-1 hover:bg-brand-700 hover:shadow-lg active:scale-98"
          >
            Записаться на бесплатный разбор
          </a>

          <p className="mx-auto mt-4 max-w-xl text-xs text-slate-500 sm:text-sm">
            Источники: Минпросвещения, 2026 год.
          </p>
        </div>
      </div>
    </Section>
  );
}
