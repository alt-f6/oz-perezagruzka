"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import { floatY } from "@/landing/components/ui/motion";
import { reachGoal } from "@/landing/lib/analytics";
import { useExam } from "@/landing/lib/exam-context";
import {
  HERO_TITLE,
  HERO_GUARANTEE_BULLETS,
  HERO_SUBLIST_HEADER,
  HERO_SUBLIST_ITEMS,
} from "@/landing/lib/exam-content";

const FLOATING_BADGES = [
  { label: "9 лет практики", className: "bg-hero-glow-pink text-white" },
  { label: "80% родителей — по рекомендации", className: "bg-accent-500 text-ink-900" },
  { label: "Лицензия", className: "bg-brand-600 text-white" },
  { label: "Налоговый вычет", className: "border-2 border-ink-900 text-ink-900 bg-white/80" },
];

const BLOB_SHAPE = "42% 58% 63% 37% / 41% 44% 56% 59%";

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
      <section className="relative overflow-hidden border-b border-ink-100 bg-ink-900 px-6 py-28 md:py-40 text-ink-900">
        <video
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          src="/landing/video/hero-background.mp4"
          poster="/photos/photo_2023-06-19_11-11-04.jpg"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-br from-sky-200/30 via-ink-900/80 to-ink-900/95"
        />
        <Atmosphere variant="mixed" intensity="premium" />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[36rem] w-[56rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[image:var(--gradient-brand-radial)] blur-2xl"
        />

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-16 lg:flex-row lg:items-center">

          <div className="flex-1 space-y-8 text-center md:text-left">
            <AnimatePresence mode="wait">
              <motion.h1
                key={`title-${exam}`}
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="font-bold text-white text-balance"
              >
                {title}
              </motion.h1>
            </AnimatePresence>

            <ul className="mx-auto max-w-lg space-y-2.5 text-left md:mx-0">
              {HERO_GUARANTEE_BULLETS.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5 text-lg leading-relaxed text-white/70 font-normal">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-300" aria-hidden="true" />
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
                className="max-w-lg rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"
              >
                <p className="text-sm font-bold uppercase tracking-wide text-accent-300">
                  {HERO_SUBLIST_HEADER}
                </p>
                <ul className="mt-2 space-y-1.5 text-left">
                  {sublistItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-base leading-relaxed text-white/85">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/60" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center md:justify-start pt-2">
              <motion.a
                  href="#readiness-map"
                  onClick={() => reachGoal("quiz_start")}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 90, damping: 18 }}
                  className="group relative flex min-h-[70px] items-center justify-center overflow-hidden rounded-xl bg-brand-600 px-8 py-4 text-center text-xl leading-snug text-balance font-bold text-white shadow-lg shadow-brand-600/25 transition-shadow duration-300 hover:shadow-xl hover:shadow-brand-600/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:min-h-[80px] sm:text-2xl"
              >
                {!prefersReducedMotion && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-brand-500"
                    animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.15, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                Записаться на бесплатный разбор
              </motion.a>
            </div>

            <p className="max-w-lg text-sm font-semibold text-white/80">
              Целевой балл — в договоре. Не выводим на него — возвращаем деньги
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 md:justify-start">
              {FLOATING_BADGES.map((badge, i) => (
                <motion.div
                  key={badge.label}
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: prefersReducedMotion ? 0 : i * 0.12 }}
                  style={{ borderRadius: BLOB_SHAPE }}
                  className={`px-5 py-3 text-sm font-bold shadow-card backdrop-blur-xl ${badge.className}`}
                >
                  <span className="font-mono">{badge.label}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="relative w-full flex-1 max-w-[520px] lg:max-w-none group">
            <div className="absolute -inset-6 bg-gradient-to-tr from-brand-400 to-accent-300 rounded-[48px] opacity-25 blur-3xl group-hover:opacity-30 transition duration-500" />

            <div className="relative overflow-hidden rounded-3xl border border-brand-100/80 bg-white/90 p-6 shadow-2xl shadow-brand-900/15 shadow-[var(--shadow-brand-elevated)] ring-1 ring-white/10 backdrop-blur-md">
              <div className="mb-6 flex items-center justify-between border-b border-ink-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-ink-200" />
                    <span className="h-3 w-3 rounded-full bg-accent-300" />
                    <span className="h-3 w-3 rounded-full bg-brand-300" />
                  </div>
                  <div className="h-4 w-px bg-ink-200 mx-2" />
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

              <div className="space-y-4 min-h-[220px]">
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-none bg-brand-600 px-4 py-3 text-sm text-white shadow-md">
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
                      <div className="max-w-[85%] rounded-2xl rounded-tl-none bg-brand-50 px-4 py-3 text-sm leading-relaxed text-ink-800 border border-brand-100">
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

              <div className="mt-6 flex items-center justify-between border-t border-ink-100 pt-4">
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

            <motion.div
              {...floatY(prefersReducedMotion, 4.5, 8)}
              className="mt-4 flex items-center gap-3 rounded-2xl border border-white/40 bg-white/80 p-4 shadow-[var(--shadow-brand-soft)] backdrop-blur-xl sm:absolute sm:-bottom-6 sm:-left-6 sm:mt-0"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs font-bold text-ink-500 uppercase tracking-wider leading-none">Отчёт для родителей</div>
                  <div className="text-sm font-extrabold text-ink-900 mt-0.5">Раз в 2 недели</div>
                </div>
                <span className="rounded bg-accent-100 px-1.5 py-0.5 text-xs font-bold text-accent-700">
                ИИ на связи 24/7
              </span>
              </div>
            </motion.div>
          </div>

        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "var(--gradient-brand-ellipse)" }}
          aria-hidden="true"
        />
      </section>
  );
}