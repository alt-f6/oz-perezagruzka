"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
    className: "bg-[#0055FF] text-white",
    radius: "42% 58% 63% 37% / 41% 44% 56% 59%",
    from: { opacity: 0, x: -80, y: -40 },
  },
  {
    label: "80% родителей — по рекомендации",
    className: "bg-[#AAEE00] text-[#111111]",
    radius: "58% 42% 37% 63% / 44% 41% 59% 56%",
    from: { opacity: 0, x: 80, y: -40 },
  },
  {
    label: "Лицензия",
    className: "bg-[#FF6EB4] text-[#111111]",
    radius: "63% 37% 42% 58% / 56% 59% 41% 44%",
    from: { opacity: 0, x: -80, y: 40 },
  },
  {
    label: "Налоговый вычет",
    className: "bg-white text-[#111111] border-2 border-[#111111]",
    radius: "37% 63% 58% 42% / 59% 56% 44% 41%",
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
              <ul className="mt-2.5 space-y-1.5 text-left">
                {sublistItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm md:text-base leading-relaxed text-ink-800">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-600" aria-hidden="true" />
                    <span>{item}</span>
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

          <div className="flex flex-wrap items-center justify-center gap-4 pt-6 md:justify-start">
            {TRUST_BADGES.map((badge, i) => (
              <motion.div
                key={badge.label}
                initial={prefersReducedMotion ? undefined : badge.from}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ type: "spring", stiffness: 70, damping: 14, delay: prefersReducedMotion ? 0 : i * 0.1 }}
                style={{ borderRadius: badge.radius }}
                className={`inline-flex max-w-[170px] items-center justify-center whitespace-normal px-6 py-5 text-center font-sans text-sm md:text-base font-bold leading-tight shadow-md ${badge.className}`}
              >
                {badge.label}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[320px] flex-1 lg:mx-0 lg:max-w-[380px]">
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[2rem] border-4 border-white shadow-2xl shadow-brand-900/20">
            <video
              className="h-full w-full object-cover"
              poster="/landing/photos/photo_2023-06-19_11-11-04.jpg"
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
            >
              <source src="/landing/videos/4873106-hd_1080_1920_25fps.mp4" type="video/mp4" />
            </video>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/60 via-transparent to-transparent"
            />
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 shadow-sm backdrop-blur-md">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm">
                🤖
              </span>
              <span className="text-xs font-bold text-ink-900">ИИ на связи 24/7</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
