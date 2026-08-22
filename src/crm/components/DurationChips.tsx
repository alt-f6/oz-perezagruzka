"use client";

import { lessonDurationOptions } from "@/crm/lib/schemas";

type DurationMinutes = (typeof lessonDurationOptions)[number];

export function DurationChips({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: DurationMinutes) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {lessonDurationOptions.map((minutes) => {
        const active = value === minutes;
        return (
          <button
            key={minutes}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(minutes)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
              active
                ? "bg-accent text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {minutes} мин
          </button>
        );
      })}
    </div>
  );
}
