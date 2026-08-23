"use client";

import { useExam, type ExamType } from "@/landing/lib/exam-context";
import { reachGoal } from "@/landing/lib/analytics";

const OPTIONS: { value: ExamType; label: string }[] = [
  { value: "oge", label: "9 класс · ОГЭ" },
  { value: "ege", label: "10–11 класс · ЕГЭ" },
];

export default function ExamToggle() {
  const { exam, setExam } = useExam();

  const handleSelect = (value: ExamType) => {
    if (value === "ege") reachGoal("exam_toggle_ege");
    setExam(value);
  };

  return (
    <div className="flex justify-center border-b border-ink-100 bg-white/85 px-3 py-3 backdrop-blur-xl sm:px-4">
      <div
        role="radiogroup"
        aria-label="Класс и экзамен"
        className="inline-flex w-full max-w-full flex-wrap justify-center gap-1 rounded-full border border-ink-200 bg-ink-50 p-1 sm:w-auto sm:flex-nowrap"
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
              className={`rounded-full px-3 py-2 text-xs font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:px-4 sm:text-sm ${
                selected
                  ? "bg-brand-600 text-white shadow-sm shadow-brand-900/20"
                  : "text-ink-600 hover:text-ink-900"
              }`}
            >
              [ {option.label} ]
            </button>
          );
        })}
      </div>
    </div>
  );
}
