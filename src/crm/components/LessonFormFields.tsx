"use client";

import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";

import type { LessonValues } from "@/crm/lib/schemas";
import { TimeSlotPicker } from "./TimeSlotPicker";

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" },
];

const MAX_RECURRENCE_MONTHS = 3;

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function maxEndDateIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + MAX_RECURRENCE_MONTHS);
  return d.toISOString().split("T")[0];
}

export function LessonFormFields({
  register,
  watch,
  setValue,
  errors,
  groups,
  isSubmitting,
}: {
  register: UseFormRegister<LessonValues>;
  watch: UseFormWatch<LessonValues>;
  setValue: UseFormSetValue<LessonValues>;
  errors: FieldErrors<LessonValues>;
  groups: { id: string; name: string }[];
  isSubmitting: boolean;
}) {
  const recurrence = watch("recurrence");
  const selectedDays = watch("recurrenceDays") ?? [];

  const toggleDay = (day: number) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    setValue("recurrenceDays", next, { shouldValidate: true });
  };

  return (
    <>
      <div>
        <label className="label">Группа</label>
        <select disabled={isSubmitting} {...register("groupId")} className="input">
          <option value="">Выберите группу...</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        {errors.groupId && <p className="field-error">{errors.groupId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Дата</label>
          <input
            type="date"
            disabled={isSubmitting}
            min={todayIso()}
            {...register("date")}
            className="input"
          />
          {errors.date && <p className="field-error">{errors.date.message}</p>}
        </div>
        <div>
          <label className="label">Время</label>
          <TimeSlotPicker disabled={isSubmitting} {...register("time")} />
          {errors.time && <p className="field-error">{errors.time.message}</p>}
        </div>
      </div>

      <div>
        <label className="label">Повторять занятие</label>
        <select disabled={isSubmitting} {...register("recurrence")} className="input">
          <option value="NONE">Не повторять</option>
          <option value="WEEKDAYS">Каждые будни (Пн–Пт)</option>
          <option value="WEEKLY">Раз в неделю</option>
          <option value="CUSTOM">Выбранные дни недели</option>
        </select>
      </div>

      {recurrence === "CUSTOM" && (
        <div>
          <label className="label">Дни недели</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_OPTIONS.map((opt) => {
              const active = selectedDays.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => toggleDay(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                    active
                      ? "bg-accent text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {errors.recurrenceDays && <p className="field-error">{errors.recurrenceDays.message}</p>}
        </div>
      )}

      {recurrence !== "NONE" && (
        <div>
          <label className="label">Повторять до</label>
          <input
            type="date"
            disabled={isSubmitting}
            min={todayIso()}
            max={maxEndDateIso()}
            {...register("recurrenceEndDate")}
            className="input"
          />
          {errors.recurrenceEndDate && (
            <p className="field-error">{errors.recurrenceEndDate.message}</p>
          )}
        </div>
      )}
    </>
  );
}
