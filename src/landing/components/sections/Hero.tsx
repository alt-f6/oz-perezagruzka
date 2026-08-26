"use client";

import { useEffect, useState } from "react";
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
  { label: "9 лет практики", className: "bg-[#FF6EB4] text-[#111111]" },
  { label: "80% родителей — по рекомендации", className: "bg-[#AAEE00] text-[#111111]" },
  { label: "Лицензия", className: "bg-[#0055FF] text-white" },
  { label: "Налоговый вычет", className: "bg-white text-[#111111] border border-slate-300" },
];

export default function Hero() {
  const prefersReducedMotion = useReducedMotion();
  const [aiReplyTimerFired, setAiReplyTimerFired] = useState(false);
  const aiReplyVisible = Boolean(prefersReducedMotion) || aiReplyTimerFired;
  const { exam } = useExam();
  const title = HERO_TITLE[exam];
  const sublistItems = HERO_SUBLIST_ITEMS[exam];

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = setTimeout(() => setAiReplyTimerFired(true), 1200);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  return (
    <section className="relative overflow-hidden bg-ink-900 px-6 py-16 md:py-24 text-white">
      <video
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover"
        poster="/photos/photo_2023-06-19_11-11-04.jpg"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      >
        <source src="/landing/video/hero-background.mp4" type="video/mp4" />
      </video>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-ink-900/85 via-ink-900/70 to-ink-900/90"
      />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center">

        <div className="flex-1 space-y-6 text-center md:text-left">
          <AnimatePresence mode="wait">
            <motion.h1
              key={`title-${exam}`}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="font-extrabold text-white text-balance tracking-tight"
            >
              {title}
            </motion.h1>
          </AnimatePresence>

          <ul className="mx-auto max-w-lg space-y-2 text-left md:mx-0">
            {HERO_GUARANTEE_BULLETS.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-base md:text-lg leading-relaxed text-white/85 font-medium">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" aria-hidden="true" />
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
              className="max-w-lg rounded-2xl border border-white/15 bg-white/10 p-5 shadow-sm backdrop-blur-md"
            >
              <p className="text-xs md:text-sm font-bold uppercase tracking-wider text-accent-300">
                {HERO_SUBLIST_HEADER}
              </p>
              <ul className="mt-2.5 space-y-1.5 text-left">
                {sublistItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm md:text-base leading-relaxed text-white/90">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start pt-1">
            <motion.a
              href="#readiness-map"
              onClick={() => reachGoal("quiz_start")}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
              className="group relative flex min-h-[64px] items-center justify-center overflow-hidden rounded-xl bg-brand-600 px-8 py-4 text-center text-lg md:text-xl font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-[72px]"
            >
              Записаться на бесплатный разбор
            </motion.a>
          </div>

          <p className="max-w-lg text-sm font-semibold text-white/70">
            Целевой балл — в договоре. Не выводим на него — возвращаем деньги
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 md:justify-start">
            {TRUST_BADGES.map((badge, i) => (
              <motion.div
                key={badge.label}
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut", delay: prefersReducedMotion ? 0 : i * 0.06 }}
                className={`inline-flex items-center whitespace-nowrap rounded-full px-4 py-2 font-sans text-xs md:text-sm font-bold shadow-sm ${badge.className}`}
              >
                {badge.label}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative w-full flex-1 max-w-[500px] lg:max-w-none">
          <div className="relative overflow-hidden rounded-3xl border border-brand-200/80 bg-white/95 p-6 shadow-xl shadow-brand-900/5 backdrop-blur-md">
            <div className="mb-5 flex items-center justify-between border-b border-ink-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-ink-200" />
                  <span className="h-3 w-3 rounded-full bg-accent-300" />
                  <span className="h-3 w-3 rounded-full bg-brand-300" />
                </div>
                <div className="h-4 w-px bg-ink-200 mx-1.5" />
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-600 text-sm border border-brand-200">
                    🤖
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-accent-500" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink-900 leading-none">ИИ-Репетитор</h4>
                  <span className="text-xs text-ink-500 font-medium">Школа «Перезагрузка»</span>
                </div>
              </div>
              <span className="rounded-md bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700 uppercase tracking-wider">
                ОГЭ 2026
              </span>
            </div>

            <div className="space-y-4 min-h-[200px]">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-brand-600 px-4 py-3 text-sm text-white shadow-sm">
                  Почему в квадратном уравнении, если дискриминант меньше нуля, то нет корней? 🧐
                </div>
              </div>

              <AnimatePresence mode="wait">
                {aiReplyVisible ? (
                  <motion.div
                    key="reply"
                    initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="flex justify-start"
                  >
                    <div className="max-w-[90%] rounded-2xl rounded-tl-none bg-brand-50/80 px-4 py-3 text-sm leading-relaxed text-ink-800 border border-brand-100">
                      Смотри, всё очень просто! График квадратного уравнения — это парабола.
                      <br /><br />
                      Когда дискриминант меньше нуля, эта парабола парит над осью X и вообще её не касается. Раз нет точек пересечения, значит и корней нет. Парабола просто улетела в космос! 🚀
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="typing"
                    exit={{ opacity: 0 }}
                    className="flex justify-start"
                    aria-hidden="true"
                  >
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none border border-brand-100 bg-brand-50 px-4 py-3">
                      <span className="h-2 w-2 rounded-full bg-brand-400 motion-safe:animate-bounce motion-safe:[animation-delay:-0.2s]" />
                      <span className="h-2 w-2 rounded-full bg-brand-400 motion-safe:animate-bounce motion-safe:[animation-delay:-0.1s]" />
                      <span className="h-2 w-2 rounded-full bg-brand-400 motion-safe:animate-bounce" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-ink-100 pt-3.5">
              <div className="text-xs text-ink-500 px-1">Например: как работают квадратные уравнения?</div>
              <button
                type="button"
                onClick={() => document.getElementById("readiness-map")?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" })}
                className="rounded-lg bg-brand-500 text-white text-xs font-bold px-4 py-2 transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                Спросить
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-brand-100/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-500 text-ink-900">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="text-[11px] font-bold text-ink-500 uppercase tracking-wider leading-none">Отчёт для родителей</div>
                <div className="text-xs font-extrabold text-ink-900 mt-0.5">Раз в 2 недели</div>
              </div>
            </div>
            <span className="rounded bg-accent-100 px-2 py-0.5 text-xs font-bold text-accent-800">
              ИИ на связи 24/7
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}