"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import { floatY } from "@/landing/components/ui/motion";
import { reachGoal } from "@/landing/lib/analytics";
import { useExam } from "@/landing/lib/exam-context";
import { HERO_CONTENT } from "@/landing/lib/exam-content";

const HERO_FACES = [
  "photo_2023-06-19_11-11-04.jpg",
  "photo_2023-06-19_11-19-47.jpg",
  "photo_2023-06-19_11-19-56.jpg",
];

const HERO_STUDENT_PHOTO = "photo_2026-08-23_11-25-16.jpg";

const HERO_BENEFITS = [
  "Живой учитель видит именно вашего ребёнка, а не поток на сотни — до 10 человек в группе",
  "ИИ-репетитор на связи 24/7",
  "Берём только после бесплатного разбора — если не доведём до результата, честно скажем и не возьмём денег",
];

export default function Hero() {
  const prefersReducedMotion = useReducedMotion();
  const [aiReplyTimerFired, setAiReplyTimerFired] = useState(false);
  const aiReplyVisible = Boolean(prefersReducedMotion) || aiReplyTimerFired;
  const { exam } = useExam();
  const { title, subtitle } = HERO_CONTENT[exam];

  useEffect(() => {
    if (prefersReducedMotion) return;
    const timer = setTimeout(() => setAiReplyTimerFired(true), 1200);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  return (
      <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-br from-brand-900 via-brand-800 to-ink-900 px-6 py-28 md:py-40 text-ink-900">
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

            <AnimatePresence mode="wait">
              <motion.p
                key={`subtitle-${exam}`}
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: "easeOut", delay: 0.04 }}
                className="max-w-lg text-lg leading-relaxed text-white/70 font-normal"
              >
                {subtitle}
              </motion.p>
            </AnimatePresence>

            <ul className="mx-auto max-w-lg space-y-2.5 text-left md:mx-0">
              {HERO_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-lg leading-relaxed text-white/70 font-normal">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-300" aria-hidden="true" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center md:justify-start pt-2">
              <motion.a
                  href="#readiness-map"
                  onClick={() => reachGoal("quiz_start")}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 90, damping: 18 }}
                  className="group relative overflow-hidden rounded-xl bg-accent-500 px-8 py-4 text-center leading-snug text-balance font-bold text-ink-900 shadow-lg shadow-accent-500/25 shadow-[var(--shadow-accent-glow)] transition-shadow duration-300 hover:shadow-xl hover:shadow-accent-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300"
              >
                {!prefersReducedMotion && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-accent-400"
                    animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.15, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                Записаться на бесплатный разбор с экспертом
              </motion.a>

              <motion.a
                  href="#readiness-map"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 90, damping: 18 }}
                  className="rounded-xl border border-ink-200 bg-white px-8 py-4 text-center font-semibold text-ink-700 transition-colors duration-300 hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                Собрать Карту готовности за 2 минуты
              </motion.a>
            </div>

            <p className="max-w-lg text-sm font-semibold text-white/80">
              Целевой балл — в договоре. Не выводим на него — возвращаем деньги
            </p>

            <div className="flex items-center justify-center gap-3 pt-4 md:justify-start">
              <div className="flex -space-x-3">
                {HERO_FACES.map((file) => (
                  <div
                    key={file}
                    className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-white shadow-sm"
                  >
                    <Image
                      src={`/photos/${file}`}
                      alt="Ученик образовательного центра «Перезагрузка»"
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
              <span className="text-sm font-medium text-white/50">Присоединяйся к нашим ученикам</span>
            </div>

            <dl className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 pt-2 text-sm font-semibold text-ink-600 md:justify-start">
              <motion.div
                {...floatY(prefersReducedMotion, 4)}
                className="flex items-center gap-1.5 rounded-full border border-white/40 bg-white/70 px-3.5 py-1.5 shadow-card backdrop-blur-xl"
              >
                <dt className="sr-only">Опыт практики</dt>
                <dd>9 лет практики</dd>
              </motion.div>
              <motion.div
                {...floatY(prefersReducedMotion, 5)}
                className="flex items-center gap-1.5 rounded-full border border-white/40 bg-white/70 px-3.5 py-1.5 shadow-card backdrop-blur-xl"
              >
                <dt className="sr-only">Родители по рекомендации</dt>
                <dd>80% родителей — по рекомендации</dd>
              </motion.div>
            </dl>
          </div>

          <div className="relative w-full flex-1 max-w-[520px] lg:max-w-none group">
            <div className="absolute -inset-6 bg-gradient-to-tr from-brand-400 to-accent-300 rounded-[48px] opacity-25 blur-3xl group-hover:opacity-30 transition duration-500" />

            <motion.div
              {...floatY(prefersReducedMotion, 5, 6)}
              className="absolute -top-10 -left-10 z-10 hidden w-36 sm:block sm:w-44"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-8 -left-8 -z-10 h-28 w-28 rounded-full bg-[#FF6EB4] opacity-70 blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -top-8 -right-8 -z-10 h-28 w-28 rounded-full bg-[#AAEE00] opacity-70 blur-2xl"
              />
              <div className="relative aspect-[3/4] overflow-hidden rounded-[22px] border-[4px] border-[#0055FF]">
                <Image
                  src={`/photos/${HERO_STUDENT_PHOTO}`}
                  alt="Ученики образовательного центра «Перезагрузка» у доски"
                  fill
                  priority
                  sizes="176px"
                  className="object-cover object-top"
                />
              </div>
            </motion.div>
            <div className="relative overflow-hidden rounded-3xl border border-purple-100/80 bg-white/90 p-6 shadow-2xl shadow-brand-900/15 shadow-[var(--shadow-brand-elevated)] ring-1 ring-white/10 backdrop-blur-md">
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