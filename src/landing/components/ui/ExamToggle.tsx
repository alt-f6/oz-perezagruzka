"use client";

import { motion } from "framer-motion";
import { useExam, type ExamType } from "@/landing/lib/exam-context";
import { reachGoal } from "@/landing/lib/analytics";

const OPTIONS: { value: ExamType; grade: string; title: string }[] = [
  { value: "oge", grade: "9 класс", title: "ОГЭ" },
  { value: "ege", grade: "10–11 класс", title: "ЕГЭ" },
];

export default function ExamToggle() {
  const { exam, setExam } = useExam();

  const handleSelect = (value: ExamType) => {
    if (exam === value) return;
    if (value === "ege") reachGoal("exam_toggle_ege");
    setExam(value);

    const url = new URL(window.location.href);
    if (value === "ege") {
      url.searchParams.set("exam", "ege");
    } else {
      url.searchParams.delete("exam");
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="relative z-20 mx-auto max-w-6xl px-4 pt-5 pb-2 sm:px-6">
      <div
        role="radiogroup"
        aria-label="Класс и экзамен"
        className="mx-auto flex max-w-2xl items-center justify-center rounded-2xl border border-brand-200/80 bg-white/90 p-1.5 shadow-md shadow-brand-900/5 backdrop-blur-md"
      >
        {OPTIONS.map((option) => {
          const selected = exam === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => handleSelect(option.value)}
              className={`relative flex min-h-[58px] flex-1 items-center justify-center rounded-xl px-4 text-base font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-[66px] sm:text-lg ${
                selected ? "text-white" : "text-ink-600 hover:bg-slate-100/50 hover:text-ink-900"
              }`}
            >
              {selected && (
                <motion.div
                  layoutId="activeExamToggleTab"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-0 rounded-xl bg-brand-600 shadow-md shadow-brand-600/25"
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-2 sm:gap-2.5">
                <span className="text-xs font-semibold tracking-wide opacity-85 sm:text-sm">
                  {option.grade}
                </span>
                <span className="h-1 w-1 rounded-full bg-current opacity-40" aria-hidden="true" />
                <span className="font-extrabold tracking-tight sm:text-xl">
                  {option.title}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}