"use client";

import { useState } from "react";
import type { FormEventHandler } from "react";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormTrigger,
  UseFormWatch,
} from "react-hook-form";

import type { LessonValues } from "@/crm/lib/schemas";
import { LessonDaySlots } from "./LessonDaySlots";
import { LessonFormFields } from "./LessonFormFields";

const TOTAL_STEPS = 2;

// Fields owned by step 1. Validated before advancing so the user can't skip
// ahead over a missing group/date/time or an unfinished recurrence config.
const STEP_ONE_FIELDS: (keyof LessonValues)[] = [
  "groupId",
  "date",
  "time",
  "durationMinutes",
  "recurrence",
  "recurrenceDays",
  "recurrenceEndDate",
];

const STEP_TITLES = ["Основное", "Время"];

/**
 * Two-step lesson creation wizard.
 *
 * Step 1 collects the group, date, default time/duration and recurrence.
 * Step 2 lets multi-day series set an independent time/duration per weekday.
 *
 * "Назад" moves strictly one step back (N → N-1) by decrementing local step
 * state — it never touches browser history or closes the dialog — and because
 * the whole thing is a single react-hook-form instance, every field entered on
 * either step is preserved across backward/forward transitions.
 */
export function LessonWizard({
  register,
  watch,
  setValue,
  trigger,
  errors,
  groups,
  isSubmitting,
  onSubmit,
}: {
  register: UseFormRegister<LessonValues>;
  watch: UseFormWatch<LessonValues>;
  setValue: UseFormSetValue<LessonValues>;
  trigger: UseFormTrigger<LessonValues>;
  errors: FieldErrors<LessonValues>;
  groups: { id: string; name: string; teacherId?: string | null }[];
  isSubmitting: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  const [step, setStep] = useState(1);

  const goNext = async () => {
    const valid = await trigger(STEP_ONE_FIELDS);
    if (valid) setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  // Strictly one step back, preserving all form state.
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center gap-2" aria-label="Шаги">
        {STEP_TITLES.map((title, index) => {
          const stepNumber = index + 1;
          const active = stepNumber === step;
          const done = stepNumber < step;
          return (
            <div key={title} className="flex items-center gap-1.5">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-accent text-white"
                    : done
                      ? "bg-accent/15 text-accent"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {stepNumber}
              </span>
              <span
                className={`text-xs font-medium ${
                  active ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {title}
              </span>
              {stepNumber < TOTAL_STEPS && (
                <span className="mx-1 h-px w-4 bg-slate-200" />
              )}
            </div>
          );
        })}
      </div>

      {step === 1 ? (
        <LessonFormFields
          register={register}
          watch={watch}
          setValue={setValue}
          errors={errors}
          groups={groups}
          isSubmitting={isSubmitting}
        />
      ) : (
        <LessonDaySlots
          watch={watch}
          setValue={setValue}
          errors={errors}
          isSubmitting={isSubmitting}
        />
      )}

      <div className="flex gap-2">
        {step > 1 && (
          <button
            type="button"
            onClick={goBack}
            disabled={isSubmitting}
            className="btn-secondary flex-1"
          >
            Назад
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={goNext}
            disabled={isSubmitting}
            className="btn-primary flex-1"
          >
            Далее
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex-1"
          >
            {isSubmitting ? "Создание..." : "Создать"}
          </button>
        )}
      </div>
    </form>
  );
}
