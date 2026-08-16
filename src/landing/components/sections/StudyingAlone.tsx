"use client";

import Image from "next/image";
import { AlertTriangle, Clock, HelpCircle, TrendingDown, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Card from "@/landing/components/ui/Card";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";

const STUDYING_ALONE_PHOTO = "photo_2023-06-19_11-18-57.jpg";

const POINTS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: AlertTriangle,
    title: "Отсутствие системы",
    desc: "Сложно удерживать дисциплину и регулярно возвращаться к сложным темам без внешнего контроля.",
  },
  {
    icon: HelpCircle,
    title: "Нерешенные вопросы",
    desc: "При возникновении трудностей в сложной задаче некому оперативно объяснить правильный алгоритм решения.",
  },
  {
    icon: TrendingDown,
    title: "Потеря мотивации",
    desc: "Без трекинга прогресса и экспертной поддержки быстро угасает интерес к предмету.",
  },
  {
    icon: Clock,
    title: "Потеря времени",
    desc: "На самостоятельный поиск верного решения уходит в 3–4 раза больше времени, чем с ментором.",
  },
];

export default function StudyingAlone() {
  const prefersReducedMotion = useReducedMotion();
  const itemVariants = fadeInUp(prefersReducedMotion);

  return (
    <Section tone="white" className="border-y border-ink-100">
      <div className="relative mx-auto max-w-5xl px-6">
        <div className="mb-10 text-center md:text-left">
          <span className="inline-block rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-bold text-rose-700">
            Риски самостоятельной подготовки
          </span>
          <h2 className="mt-5 max-w-xl font-bold tracking-tight text-ink-900 text-balance">
            Что происходит, если ребенок занимается самостоятельно?
          </h2>
        </div>

        <div className="grid gap-10 md:grid-cols-[minmax(0,260px)_1fr] md:items-start md:gap-12">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[260px] overflow-hidden rounded-3xl border-2 border-white shadow-xl shadow-ink-900/10 md:mx-0">
            <Image
              src={`/photos/${STUDYING_ALONE_PHOTO}`}
              alt="Ученик готовится к ОГЭ самостоятельно"
              fill
              sizes="(min-width: 768px) 260px, 60vw"
              className="object-cover"
            />
          </div>

          <motion.ul
            variants={staggerContainer(0.1)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="space-y-3"
          >
            {POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <motion.li
                  key={point.title}
                  variants={itemVariants}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                >
                  <Card
                    tint="glass"
                    className="group relative flex items-start gap-4 overflow-hidden border-l-4 border-l-rose-300 pl-5 transition-all duration-300 hover:border-l-rose-400 hover:shadow-[var(--shadow-rose-glow)]"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 transition-colors group-hover:bg-rose-100">
                      <Icon className="h-5 w-5" strokeWidth={2.25} />
                    </div>
                    <div>
                      <h3 className="font-bold tracking-tight text-ink-900">{point.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{point.desc}</p>
                    </div>
                  </Card>
                </motion.li>
              );
            })}
          </motion.ul>
        </div>
      </div>
    </Section>
  );
}
