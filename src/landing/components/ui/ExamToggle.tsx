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
    <div className="border-b border-ink-100 bg-white/85 px-3 py-4 backdrop-blur-xl sm:px-6">
      <div
        role="radiogroup"
        aria-label="Класс и экзамен"
        className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-ink-200 bg-ink-50 p-2 sm:flex-row"
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
              className={`flex min-h-[70px] flex-1 items-center justify-center rounded-xl px-4 text-xl font-extrabold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-[80px] sm:text-2xl ${
                selected
                  ? "bg-brand-600 text-white shadow-sm shadow-brand-900/20"
                  : "border border-ink-200 bg-white text-ink-600 hover:text-ink-900"
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
