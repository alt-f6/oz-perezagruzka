"use client";

import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  parseDateKey,
  toDateKey,
} from "@/crm/lib/calendarGrid";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<Date>(() => (value ? parseDateKey(value) : new Date()));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setCursor(parseDateKey(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const isDisabledKey = (key: string) => Boolean((min && key < min) || (max && key > max));

  const selectDay = (key: string) => {
    if (isDisabledKey(key)) return;
    onChange(key);
    setOpen(false);
  };

  const onDayKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    const deltaMap: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    const delta = deltaMap[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const next = addDays(parseDateKey(key), delta);
    setCursor(next);
    const nextKey = toDateKey(next);
    requestAnimationFrame(() => {
      containerRef.current?.querySelector<HTMLButtonElement>(`[data-day="${nextKey}"]`)?.focus();
    });
  };

  const days = buildMonthGrid(cursor);
  const currentMonth = cursor.getMonth();
  const label = value
    ? parseDateKey(value).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
    : "Выберите дату";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="input flex w-full items-center gap-2 text-left"
      >
        <CalendarIcon size={15} className="text-slate-500" />
        {label}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-card-hover">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              className="icon-btn h-7 w-7"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-slate-900">
              {cursor.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="icon-btn h-7 w-7"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_LABELS.map((weekday) => (
              <span key={weekday} className="text-[11px] font-medium text-slate-400">
                {weekday}
              </span>
            ))}
            {days.map((day) => {
              const key = toDateKey(day);
              const dayDisabled = isDisabledKey(key);
              const inMonth = day.getMonth() === currentMonth;
              return (
                <button
                  key={key}
                  type="button"
                  data-day={key}
                  disabled={dayDisabled}
                  tabIndex={inMonth ? 0 : -1}
                  onClick={() => selectDay(key)}
                  onKeyDown={(e) => onDayKeyDown(e, key)}
                  className={`h-8 rounded-lg text-xs font-medium transition-colors ${
                    key === value
                      ? "bg-accent text-white"
                      : dayDisabled
                        ? "cursor-not-allowed text-slate-300"
                        : inMonth
                          ? "text-slate-700 hover:bg-slate-100"
                          : "text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
