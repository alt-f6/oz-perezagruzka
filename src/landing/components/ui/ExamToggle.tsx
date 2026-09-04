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
    <div className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6">
      <div
        role="radiogroup"
        aria-label="Класс и экзамен"
        className="mx-auto my-4 flex max-w-md items-center rounded-2xl border border-slate-200/90 bg-slate-100/95 p-1.5 shadow-inner backdrop-blur-xl sm:my-6 sm:max-w-lg"
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
              className={`relative z-10 flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-[58px] sm:text-base ${
                selected ? "text-white" : "text-slate-600 hover:bg-white/60 hover:text-ink-900"
              }`}
            >
              {selected && (
                <motion.div
                  layoutId="activeExamTab"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute inset-0 -z-10 rounded-xl border border-white/15 bg-[#0055FF] shadow-md shadow-[#0055FF]/30"
                />
              )}
              {selected && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-[#AAEE00] shadow-[0_0_8px_#AAEE00]"
                />
              )}
              <span>{option.grade} · {option.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}