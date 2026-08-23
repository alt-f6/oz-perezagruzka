"use client";

import { useEffect, useRef, useState } from "react"; 
import { motion, useReducedMotion } from "framer-motion";
import type { ReadinessOutput } from "@/landing/lib/validations/readiness";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import { ContactForm } from "./ContactForm";
import { useExam } from "@/landing/lib/exam-context";
import { RESULT_ATTENTION_ZONES_TITLE, RESULT_COPY_HEADER } from "@/landing/lib/exam-content";

interface ResultSuccessProps {
  leadId: string;
  map: ReadinessOutput;
}

export function ResultSuccess({ leadId, map }: ResultSuccessProps) {
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const { exam } = useExam();

  const BLOCKS: { key: keyof ReadinessOutput; title: string }[] = [
    { key: "whatISee", title: "Что мы видим" },
    { key: "attentionZones", title: RESULT_ATTENTION_ZONES_TITLE[exam] },
    { key: "strengths", title: "Сильные стороны" },
    { key: "futurePaths", title: "Куда это может привести" },
    { key: "firstStep", title: "Первый шаг" },
  ];

  useEffect(() => {
    // Scroll the freshly-mounted result into view exactly once. Deferring to
    // the next animation frame lets the layout settle first, so we read a
    // stable offset and avoid the double-scroll / jump the old dual-timer
    // approach caused.
    const frame = requestAnimationFrame(() => {
      const node = sectionRef.current;
      if (!node) return;

      const yOffset = -80;
      const y = node.getBoundingClientRect().top + window.scrollY + yOffset;

      window.scrollTo({
        top: y,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [prefersReducedMotion]);

  const handleCopyText = async () => {
    const formatBlock = (val: string | string[]) => {
      if (Array.isArray(val)) {
        return val.map((item) => `• ${item}`).join("\n");
      }
      return val;
    };

    const formattedText = [
      RESULT_COPY_HEADER[exam],
      `\n🔍 Что мы видим:`,
      `${formatBlock(map.whatISee)}`,
      `\n⚠️ ${RESULT_ATTENTION_ZONES_TITLE[exam]}:`,
      `${formatBlock(map.attentionZones)}`,
      `\n💪 Сильные стороны:`,
      `${formatBlock(map.strengths)}`,
      `\n🚀 Куда это может привести:`,
      `${formatBlock(map.futurePaths)}`,
      `\n🏁 Первый шаг:`,
      `${formatBlock(map.firstStep)}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Не удалось скопировать текст:", err);
    }
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-16 md:py-20">
      <Atmosphere variant="mixed" />

      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative mx-auto max-w-2xl px-6"
      >
        <div className="rounded-[40px] border border-purple-100/80 bg-white/90 p-8 sm:p-10 shadow-2xl shadow-brand-900/10 backdrop-blur-md">

          <div className="mb-8 border-b border-ink-100 pb-6">
            <span className="text-xs font-black uppercase tracking-widest text-brand-600">Результат анализа</span>
            <h3 className="font-bold tracking-tight text-ink-900 mt-1">Карта готовности</h3>
          </div>

          <div className="space-y-8">
            {BLOCKS.map(({ key, title }) => {
              const value = map[key];
              return (
                <div key={key} className="relative group">
                  <h4 className="text-xs font-black uppercase tracking-wider text-brand-600">
                    {title}
                  </h4>
                  {Array.isArray(value) ? (
                    <ul className="mt-3 list-none space-y-2 pl-1">
                      {value.map((item, i) => (
                        <li key={i} className="text-ink-600 text-sm sm:text-base leading-relaxed flex items-start gap-2.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-400 mt-2.5 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-ink-600 text-sm sm:text-base leading-relaxed pl-1">{value}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="my-10 h-px bg-gradient-to-r from-transparent via-ink-200 to-transparent" />

          <div className="space-y-6">
            
            <button
              type="button"
              onClick={handleCopyText}
              className={`w-full rounded-2xl border py-4.5 px-6 font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 active:scale-98 ${
                copied
                  ? "border-brand-300 bg-brand-50 text-brand-700 shadow-card"
                  : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50 hover:border-ink-300"
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-5 h-5 animate-bounce text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Карта успешно скопирована!</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>Скопировать карту</span>
                </>
              )}
            </button>

            <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-6 sm:p-8">
              <h5 className="font-extrabold text-base text-ink-900 mb-2">
                Хотите понять реальный уровень ребенка по конкретному предмету?
              </h5>
              <p className="text-sm text-ink-600 leading-relaxed mb-6 font-medium">
                Запишитесь на индивидуальную бесплатную консультацию. Мы составим пошаговый трек подготовки.
              </p>
              <ContactForm leadId={leadId} ctaLabel="Записаться на бесплатный разбор" />
            </div>

          </div>
          
        </div>
      </motion.div>
    </section>
  );
}