"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { reachGoal } from "@/landing/lib/analytics";
import { useExam } from "@/landing/lib/exam-context";
import {
  HERO_TITLE,
  HERO_GUARANTEE_BULLETS,
  HERO_SUBLIST_HEADER,
  HERO_SUBLIST_ITEMS,
} from "@/landing/lib/exam-content";

const TRUST_BADGES = [
  {
    label: "9 лет практики",
    className: "bg-[#FF6EB4] text-[#111111]",
    from: { opacity: 0, x: -80, y: -40 },
  },
  {
    label: "80% родителей — по рекомендации",
    className: "bg-[#AAEE00] text-[#111111]",
    from: { opacity: 0, x: 80, y: -40 },
  },
  {
    label: "Лицензия",
    className: "bg-[#0055FF] text-white",
    from: { opacity: 0, x: -80, y: 40 },
  },
  {
    label: "Налоговый вычет",
    className: "bg-white text-[#111111] border border-slate-300",
    from: { opacity: 0, x: 80, y: 40 },
  },
];

export default function Hero() {
  const prefersReducedMotion = useReducedMotion();
  const { exam } = useExam();
  const title = HERO_TITLE[exam];
  const sublistItems = HERO_SUBLIST_ITEMS[exam];

  return (
    <section className="relative overflow-hidden bg-transparent px-6 pt-16 pb-28 md:py-24 text-ink-900">
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center">

        <div className="flex-1 space-y-6 text-center md:text-left">
          <AnimatePresence mode="wait">
            <motion.h1
              key={`title-${exam}`}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="font-extrabold text-ink-900 text-balance tracking-tight"
            >
              {title}
            </motion.h1>
          </AnimatePresence>

          <ul className="mx-auto max-w-lg space-y-2 text-left md:mx-0">
            {HERO_GUARANTEE_BULLETS.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-base md:text-lg leading-relaxed text-ink-700 font-medium">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          <a
            href="#faq-guarantee"
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-700 underline decoration-brand-300 decoration-2 underline-offset-4 transition-colors hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            Подробные условия гарантии →
          </a>

          <AnimatePresence mode="wait">
            <motion.div
              key={`sublist-${exam}`}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeOut", delay: 0.04 }}
              className="max-w-lg rounded-2xl border border-brand-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm"
            >
              <p className="text-xs md:text-sm font-bold uppercase tracking-wider text-brand-700">
                {HERO_SUBLIST_HEADER}
              </p>
              <ul className="mt-2.5 list-none space-y-1.5 text-left">
                {sublistItems.map((item) => (
                  <li key={item} className="text-sm md:text-base leading-relaxed text-ink-800">
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start pt-1">
            <motion.a
              href="#readiness-map"
              onClick={() => reachGoal("cta_analysis_click")}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
              className="group relative flex min-h-[70px] items-center justify-center overflow-hidden rounded-xl bg-brand-600 px-8 py-4 text-center text-xl md:text-2xl font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-[80px]"
            >
              Записаться на бесплатный разбор
            </motion.a>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mt-4 justify-center md:justify-start">
            {TRUST_BADGES.map((badge, i) => (
              <motion.div
                key={badge.label}
                initial={prefersReducedMotion ? undefined : badge.from}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ type: "spring", stiffness: 70, damping: 14, delay: prefersReducedMotion ? 0 : i * 0.1 }}
                className={`inline-flex items-center px-4 py-2 rounded-full text-xs sm:text-sm font-bold tracking-tight shadow-sm whitespace-nowrap ${badge.className}`}
              >
                {badge.label}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[320px] flex-1 lg:mx-0 lg:max-w-[420px]">
          <div
            aria-hidden="true"
            className="absolute -bottom-8 -left-8 -z-10 h-44 w-44 rounded-full bg-pink/35 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="absolute -top-8 -right-8 -z-10 h-44 w-44 rounded-full bg-neon/35 blur-2xl"
          />
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[22px] border-[4px] border-electric shadow-xl">
            <Image
              src="/landing/photos/photo_2026-08-23_11-25-16.jpg"
              alt="Ученики «Перезагрузки» за партой на фоне доски с надписью «Перезагрузка»"
              fill
              priority
              sizes="(min-width: 1024px) 420px, (min-width: 640px) 60vw, 90vw"
              className="object-cover object-center"
            />
          </div>
        </div>

      </div>
    </section>
  );
}
