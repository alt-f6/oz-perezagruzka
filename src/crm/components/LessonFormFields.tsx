"use client";

import { useMemo, useState } from "react";
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";

import { toDateKey, todayKey } from "@/crm/lib/calendarGrid";
import { formatTimeRange } from "@/crm/lib/lessonTime";
import { moscowDateTimeToUtc } from "@/shared/lib/timezone";
import type { LessonValues } from "@/crm/lib/schemas";
import { DatePicker } from "./DatePicker";
import { DurationChips } from "./DurationChips";
import { TimeSlotPicker } from "./TimeSlotPicker";

export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" },
];

const MAX_RECURRENCE_MONTHS = 3;

// Local-calendar bounds for the date inputs. Using toDateKey (local fields)
// rather than toISOString() avoids the UTC day-shift that can otherwise render
// "today" as yesterday for positive-offset timezones late in the evening.
function todayIso(): string {
  return todayKey();
}

function maxEndDateIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + MAX_RECURRENCE_MONTHS);
  return toDateKey(d);
}

export function LessonFormFields({
  register,
  watch,
  setValue,
  errors,
  groups,
  teachers,
  students,
  isSubmitting,
}: {
  register: UseFormRegister<LessonValues>;
  watch: UseFormWatch<LessonValues>;
  setValue: UseFormSetValue<LessonValues>;
  errors: FieldErrors<LessonValues>;
  groups: { id: string; name: string; teacherId?: string | null }[];
  teachers: { id: string; fullName: string }[];
  students: { id: string; fullName: string }[];
  isSubmitting: boolean;
}) {
  const lessonType = watch("type") ?? "GROUP";
  const recurrence = watch("recurrence");
  const selectedDays = watch("recurrenceDays") ?? [];
  const date = watch("date");
  const time = watch("time");
  const durationMinutes = watch("durationMinutes") ?? 60;

  // Client-side filter for the (potentially long) individual-lesson student list.
  const [studentQuery, setStudentQuery] = useState("");
  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.fullName.toLowerCase().includes(q));
  }, [students, studentQuery]);

  // Switching format clears the other branch's selection so a stale groupId /
  // studentId can't leak into the submitted payload.
  const setLessonType = (next: "GROUP" | "INDIVIDUAL") => {
    if (next === lessonType) return;
    setValue("type", next, { shouldValidate: false });
    if (next === "GROUP") {
      setValue("studentId", "", { shouldValidate: false });
      setValue("teacherId", "", { shouldValidate: false });
    } else {
      setValue("groupId", "", { shouldValidate: false });
    }
  };

  const toggleDay = (day: number) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    setValue("recurrenceDays", next, { shouldValidate: true });
  };

  const rangeLabel =
    date && time
      ? formatTimeRange({
          // Build the same Moscow-anchored instant createLesson persists, so
          // the preview matches the stored/rendered wall-clock exactly instead
          // of floating on the browser timezone.
          scheduledAt: moscowDateTimeToUtc(date, time),
          durationMinutes,
        })
      : null;

  return (
    <>
      <div>
        <label className="label">Формат занятия</label>
        <div className="flex gap-2" role="group" aria-label="Формат занятия">
          {(
            [
              { value: "GROUP", label: "Групповое занятие" },
              { value: "INDIVIDUAL", label: "Индивидуальное занятие" },
            ] as const
          ).map((opt) => {
            const active = lessonType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isSubmitting}
                aria-pressed={active}
                onClick={() => setLessonType(opt.value)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
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
      </div>

      {/* Keep `type` in the form payload without an extra visible control. */}
      <input type="hidden" {...register("type")} />

      {lessonType === "GROUP" ? (
        <div>
          <label className="label">Группа</label>
          <select disabled={isSubmitting} {...register("groupId")} className="input">
            <option value="">Выберите группу...</option>
            {groups.map((group) => {
              const hasTeacher = Boolean(group.teacherId);
              return (
                <option
                  key={group.id}
                  value={group.id}
                  disabled={!hasTeacher}
                  title={
                    hasTeacher
                      ? undefined
                      : "Сначала назначьте преподавателя этой группе"
                  }
                >
                  {group.name}
                  {hasTeacher ? "" : " (нет преподавателя)"}
                </option>
              );
            })}
          </select>
          {errors.groupId && <p className="field-error">{errors.groupId.message}</p>}
        </div>
      ) : (
        <>
          <div>
            <label className="label">Ученик</label>
            <input
              type="search"
              placeholder="Поиск ученика..."
              value={studentQuery}
              disabled={isSubmitting}
              onChange={(e) => setStudentQuery(e.target.value)}
              className="input mb-2"
              aria-label="Поиск ученика"
            />
            <select disabled={isSubmitting} {...register("studentId")} className="input">
              <option value="">Выберите ученика...</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </select>
            {errors.studentId && (
              <p className="field-error">{errors.studentId.message}</p>
            )}
          </div>

          <div>
            <label className="label">Преподаватель</label>
            <select disabled={isSubmitting} {...register("teacherId")} className="input">
              <option value="">Выберите преподавателя...</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.fullName}
                </option>
              ))}
            </select>
            {errors.teacherId && (
              <p className="field-error">{errors.teacherId.message}</p>
            )}
          </div>

          <div>
            <label className="label">Стоимость занятия, ₽ (необязательно)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="0"
              disabled={isSubmitting}
              {...register("pricePerLesson")}
              className="input"
            />
            {errors.pricePerLesson && (
              <p className="field-error">{errors.pricePerLesson.message}</p>
            )}
          </div>
        </>
      )}

      <div>
        <label className="label">Дата</label>
        <DatePicker
          value={date ?? ""}
          onChange={(next) => setValue("date", next, { shouldValidate: true })}
          min={todayIso()}
          disabled={isSubmitting}
        />
        {errors.date && <p className="field-error">{errors.date.message}</p>}
      </div>

      <div>
        <label className="label">Время</label>
        <TimeSlotPicker
          value={time ?? ""}
          onChange={(next) => setValue("time", next, { shouldValidate: true })}
          disabled={isSubmitting}
        />
        {errors.time && <p className="field-error">{errors.time.message}</p>}
      </div>

      <div>
        <label className="label">Длительность</label>
        <DurationChips
          value={durationMinutes}
          onChange={(next) => setValue("durationMinutes", next, { shouldValidate: true })}
          disabled={isSubmitting}
        />
        {errors.durationMinutes && (
          <p className="field-error">{errors.durationMinutes.message}</p>
        )}
      </div>

      {rangeLabel && (
        <p className="text-sm font-medium text-slate-600">{rangeLabel}</p>
      )}

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
