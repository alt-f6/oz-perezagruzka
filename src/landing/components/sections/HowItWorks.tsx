"use client";

import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import Card from "@/landing/components/ui/Card";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";

const STEPS = [
  {
    title: "Диагностика",
    desc: "Бесплатная встреча с педагогом: смотрим реальный уровень, а не гадаем по оценкам в дневнике.",
  },
  {
    title: "Карта готовности",
    desc: "Отдаём на руки честную диагностику: что уже хорошо, а над чем предстоит поработать до ОГЭ.",
  },
  {
    title: "Бронь места",
    desc: "Берём только тех, кому реально сможем помочь — место закрепляется за группой (до 10 человек в группе).",
  },
  {
    title: "Занятия + контроль",
    desc: "Живой учитель ведёт по программе, ИИ-репетитор на связи 24/7, отчёт вам — каждые 2 недели.",
  },
  {
    title: "Готов к ОГЭ + навык остался",
    desc: "Ребёнок сдаёт экзамен и выходит с привычкой заниматься самостоятельно и работать с ИИ.",
  },
];

export default function HowItWorks() {
  const prefersReducedMotion = useReducedMotion();
  const itemVariants = fadeInUp(prefersReducedMotion);

  return (
    <Section id="how-it-works" tone="brand-wash" className="scroll-mt-20">
      <Atmosphere variant="brand" intensity="premium" />
      <div className="relative mx-auto max-w-5xl px-6">
        <div className="mb-16 text-center">
          <h2 className="font-bold tracking-tight text-ink-900">
            Как это работает
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-600">
            Пять понятных шагов от первого разговора до сданного ОГЭ.
          </p>
        </div>

        <motion.ol
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="relative grid gap-8 sm:grid-cols-3 lg:grid-cols-5"
        >
          {STEPS.map((step, i) => (
            <motion.li
              key={step.title}
              variants={itemVariants}
              transition={{ duration: 0.4, ease: "easeOut" }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -5 }}
              className="relative after:absolute after:top-11 after:left-[calc(100%+1rem)] after:hidden after:h-px after:w-8 after:bg-ink-200 after:content-[''] lg:after:block last:after:hidden"
            >
              <Card
                tint="glass"
                className="flex h-full flex-col transition-shadow duration-300 hover:shadow-card-hover"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-black text-brand-700 border border-brand-200">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-bold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.desc}</p>
              </Card>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </Section>
  );
}
