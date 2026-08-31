"use client";

import type { FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";

import { formatTimeRange } from "@/crm/lib/lessonTime";
import { lessonDurationOptions, type DaySlot, type LessonValues } from "@/crm/lib/schemas";
import { DurationChips } from "./DurationChips";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { WEEKDAY_OPTIONS } from "./LessonFormFields";

type DurationMinutes = (typeof lessonDurationOptions)[number];

const WEEKDAY_FULL: Record<number, string> = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
  0: "Воскресенье",
};

/**
 * Step 2 of the lesson wizard: time & duration configuration.
 *
 * For multi-day patterns (WEEKDAYS / CUSTOM) it renders one time+duration
 * editor per selected weekday, so each day of a recurring series can run at its
 * own start time and length. Untouched days fall back to the default time set
 * in step 1 (`values.time` / `values.durationMinutes`). Non-recurring (NONE) and
 * once-weekly (WEEKLY) series have a single slot, so this step only reviews it.
 */
export function LessonDaySlots({
  watch,
  setValue,
  errors,
  isSubmitting,
}: {
  watch: UseFormWatch<LessonValues>;
  setValue: UseFormSetValue<LessonValues>;
  errors: FieldErrors<LessonValues>;
  isSubmitting: boolean;
}) {
  const recurrence = watch("recurrence");
  const recurrenceDays = watch("recurrenceDays") ?? [];
  const daySlots = watch("daySlots") ?? [];
  const date = watch("date");
  const globalTime = watch("time") ?? "";
  const globalDuration = (watch("durationMinutes") ?? 60) as DurationMinutes;

  // Weekdays this pattern lands on, rendered in Mon→Sun order.
  const targetDays =
    recurrence === "WEEKDAYS"
      ? [1, 2, 3, 4, 5]
      : recurrence === "CUSTOM"
        ? WEEKDAY_OPTIONS.map((o) => o.value).filter((v) => recurrenceDays.includes(v))
        : [];

  const slotFor = (day: number): DaySlot | undefined =>
    daySlots.find((s) => s.day === day);
  const timeFor = (day: number): string => slotFor(day)?.time ?? globalTime;
  const durationFor = (day: number): DurationMinutes =>
    (slotFor(day)?.durationMinutes ?? globalDuration) as DurationMinutes;

  const updateSlot = (day: number, patch: Partial<Omit<DaySlot, "day">>) => {
    const base: DaySlot = slotFor(day) ?? {
      day,
      time: globalTime,
      durationMinutes: globalDuration,
    };
    const next: DaySlot = { ...base, ...patch };
    const others = daySlots.filter((s) => s.day !== day);
    // Keep the array stable in weekday order for predictable rendering/tests.
    const merged = [...others, next].sort((a, b) => {
      const order = (d: number) => (d === 0 ? 7 : d);
      return order(a.day) - order(b.day);
    });
    setValue("daySlots", merged, { shouldValidate: true });
  };

  const rangeLabel = (time: string, duration: number): string | null =>
    date && time
      ? formatTimeRange({ scheduledAt: `${date}T${time}:00`, durationMinutes: duration })
      : null;

  if (targetDays.length === 0) {
    const label = rangeLabel(globalTime, globalDuration);
    return (
      <div className="space-y-2">
        <label className="label">Время занятия</label>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          {label ?? "Укажите время на предыдущем шаге"}
        </div>
        <p className="text-xs text-slate-500">
          {recurrence === "WEEKLY"
            ? "Занятие будет повторяться в этот день недели в одно и то же время."
            : "Единичное занятие."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Время по дням</label>
        <p className="text-xs text-slate-500">
          Задайте своё время и длительность для каждого дня. По умолчанию
          используется время с предыдущего шага.
        </p>
      </div>

      <div className="space-y-3">
        {targetDays.map((day) => {
          const time = timeFor(day);
          const duration = durationFor(day);
          const label = rangeLabel(time, duration);
          return (
            <div
              key={day}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">
                  {WEEKDAY_FULL[day]}
                </span>
                {label && (
                  <span className="text-xs font-medium text-slate-500">{label}</span>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <span className="mb-1 block text-xs font-medium text-slate-500">
                    Время начала
                  </span>
                  <TimeSlotPicker
                    value={time}
                    onChange={(next) => updateSlot(day, { time: next })}
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-xs font-medium text-slate-500">
                    Длительность
                  </span>
                  <DurationChips
                    value={duration}
                    onChange={(next) => updateSlot(day, { durationMinutes: next })}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {errors.daySlots && (
        <p className="field-error">
          {typeof errors.daySlots.message === "string"
            ? errors.daySlots.message
            : "Укажите время для каждого выбранного дня"}
        </p>
      )}
    </div>
  );
}
