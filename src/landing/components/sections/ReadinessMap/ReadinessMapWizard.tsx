"use client";

import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Target, Clock, BarChart3, Gift, Check, ArrowRight } from "lucide-react";
import { floatY } from "@/landing/components/ui/motion";
import {
  readinessInputSchema,
  SUBJECT_VALUES,
  STUDY_STYLE_VALUES,
  HOBBY_VALUES,
  type ReadinessInput,
} from "@/landing/lib/validations/readiness";
import { submitReadinessMap, type ReadinessActionResult } from "@/landing/actions/readiness";
import { reachGoal } from "@/landing/lib/analytics";
import { LegalCheckbox } from "@/landing/components/ui/LegalCheckbox";
import Atmosphere from "@/landing/components/ui/Atmosphere";

import { useAttribution } from "./attribution";
import { ProgressDots } from "./ProgressDots";
import { LoadingState } from "./LoadingState";
import { ResultSuccess } from "./ResultSuccess";
import { ResultFallback } from "./ResultFallback";

type StepKey = keyof ReadinessInput;

interface StepConfig {
  key: StepKey;
  stepLabel: string;
  title: string;
  helper: string;
  placeholder?: string;
}

const STEPS: StepConfig[] = [
  {
    key: "name",
    stepLabel: "Имя ученика",
    title: "Как зовут ученика?",
    helper: "Необязательно — чтобы мы могли обращаться по имени",
    placeholder: "Например, Аня",
  },
  {
    key: "grade",
    stepLabel: "Класс обучения",
    title: "В каком он классе?",
    helper: "Это определяет структуру ОГЭ",
  },
  {
    key: "subjects",
    stepLabel: "Выбор предмета и класса",
    title: "К каким предметам нужно подготовиться?",
    helper: "Выберите до 2-х предметов, которые вызывают больше всего вопросов:",
  },
  {
    key: "studyStyle",
    stepLabel: "Стиль учебы",
    title: "Как обычно учится?",
    helper: "Выберите наиболее подходящий стиль учебы",
  },
  {
    key: "hobbies",
    stepLabel: "Увлечения",
    title: "Чем увлекается в свободное время?",
    helper: "Выберите одно или несколько увлечений",
  },
  {
    key: "deadline",
    stepLabel: "Срок до экзамена",
    title: "Сколько времени осталось до ОГЭ?",
    helper: "Это поможет расставить приоритеты в карте готовности",
  },
];

const GRADE_OPTIONS: { value: ReadinessInput["grade"]; label: string }[] = [
  { value: "7", label: "7 класс" },
  { value: "8", label: "8 класс" },
  { value: "9", label: "9 класс" },
];

const SUBJECT_LABELS: Record<(typeof SUBJECT_VALUES)[number], string> = {
  "Математика": "📐 Математика",
  "Русский язык": "📝 Русский язык",
  "Информатика": "💻 Информатика",
  "Обществознание": "⚖️ Обществознание",
  "Физика": "⚡ Физика",
  "Химия": "🧪 Химия",
  "Биология": "🌿 Биология",
  "География": "🌍 География",
  "Английский": "🇬🇧 Английский",
  "История": "⏳ История",
  "Литература": "📖 Литература",
};
const SUBJECT_OPTIONS = SUBJECT_VALUES.map((value) => ({ value, label: SUBJECT_LABELS[value] }));

const STUDY_STYLE_META: Record<(typeof STUDY_STYLE_VALUES)[number], { title: string; desc: string }> = {
  "Учится самостоятельно, высокая успеваемость": {
    title: "🔥 Сам и на отлично",
    desc: "Сам садится за уроки, учится на 4 и 5",
  },
  "Учится сам, но нет четкой системы знаний": {
    title: "😐 Сам, но хаотично",
    desc: "Способный ученик, но не хватает системности",
  },
  "Нужно регулярно напоминать и контролировать домашку": {
    title: "👀 Нужен контроль",
    desc: "Без родительского пинка за уроки садится неохотно",
  },
  "Учеба запущена, боимся не сдать экзамены": {
    title: "🆘 Всё запущено",
    desc: "Тяжело дается программа, боимся завалить ОГЭ",
  },
};
const STUDY_STYLE_OPTIONS = STUDY_STYLE_VALUES.map((value) => ({ value, ...STUDY_STYLE_META[value] }));

const HOBBY_LABELS: Record<(typeof HOBBY_VALUES)[number], string> = {
  "Компьютерные игры и IT": "🎮 Игры / IT",
  "Спорт и активный отдых": "⚽ Спорт",
  "Рисование, музыка, творчество": "🎨 Творчество",
  "Блогинг, соцсети, видеоролики": "📱 Соцсети",
  "Чтение и саморазвитие": "📚 Чтение",
  "Общение и прогулки с друзьями": "👥 Друзья",
};
const HOBBIES_OPTIONS = HOBBY_VALUES.map((value) => ({ value, label: HOBBY_LABELS[value] }));

const DEADLINE_OPTIONS: { value: ReadinessInput["deadline"]; label: string }[] = [
  { value: "<3m", label: "Меньше 3 месяцев" },
  { value: "3-6m", label: "3–6 месяцев" },
  { value: "6-12m", label: "6–12 месяцев" },
  { value: ">1y", label: "Больше года" },
];

const TRUST_BADGES = [
  { icon: Clock, label: "Всего 2 минуты" },
  { icon: BarChart3, label: "Экспресс-аналитика знаний" },
  { icon: Gift, label: "Персональный гайд в подарок" },
];

export default function ReadinessMapWizard() {
  const { sessionId, utm } = useAttribution();
  const prefersReducedMotion = useReducedMotion();

  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [phase, setPhase] = useState<"form" | "loading" | "result">("form");
  const [result, setResult] = useState<Exclude<ReadinessActionResult, { status: "error" }> | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const [selectedGrade, setSelectedGrade] = useState<"7" | "8" | "9">("8");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedStudyStyle, setSelectedStudyStyle] = useState<ReadinessInput["studyStyle"] | "">("");
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [selectedDeadline, setSelectedDeadline] = useState<ReadinessInput["deadline"] | "">("");
  const formRenderedAtRef = useRef(Date.now());
  const honeypotRef = useRef<HTMLInputElement>(null);

  const form = useForm<ReadinessInput>({
    resolver: zodResolver(readinessInputSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      grade: "8",
      subjects: "",
      studyStyle: undefined,
      hobbies: "",
      deadline: undefined,
    },
  });

  const currentStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const handleGradeSelect = (value: "7" | "8" | "9") => {
    setSelectedGrade(value);
    form.setValue("grade", value, { shouldValidate: true, shouldDirty: true });
  };

  const handleSubjectToggle = (value: string) => {
    const isAlreadySelected = selectedSubjects.includes(value);

    if (!isAlreadySelected && selectedSubjects.length >= 2) {
      return;
    }

    const next = isAlreadySelected
      ? selectedSubjects.filter((item) => item !== value)
      : [...selectedSubjects, value];

    setSelectedSubjects(next);
    form.setValue("subjects", next.join(", "), { shouldValidate: true, shouldDirty: true });
  };

  const handleStudyStyleSelect = (value: ReadinessInput["studyStyle"]) => {
    setSelectedStudyStyle(value);
    form.setValue("studyStyle", value, { shouldValidate: true, shouldDirty: true });
  };

  const handleHobbyToggle = (value: string) => {
    const next = selectedHobbies.includes(value)
      ? selectedHobbies.filter((item) => item !== value)
      : [...selectedHobbies, value];

    setSelectedHobbies(next);
    // Uses the "|" delimiter because several hobby values contain an
    // internal ", ", so a comma-based join/split would be ambiguous. Kept in
    // sync with the `hobbies` schema in lib/validations/readiness.ts.
    form.setValue("hobbies", next.join("|"), { shouldValidate: true, shouldDirty: true });
  };

  const handleDeadlineSelect = (value: ReadinessInput["deadline"]) => {
    setSelectedDeadline(value);
    form.setValue("deadline", value, { shouldValidate: true, shouldDirty: true });
  };

  const goNext = useCallback(async () => {
    const valid = await form.trigger(currentStep.key);
    if (!valid) return;

    reachGoal(`quiz_step_${stepIndex + 1}_completed`);

    if (!isLastStep) {
      setDirection(1);
      setStepIndex((i) => i + 1);
      return;
    }

    if (!consent) {
      setConsentError(true);
      return;
    }

    setPhase("loading");
    setSubmitError(null);
    try {
      const actionResult = await submitReadinessMap({
        input: form.getValues(),
        sessionId,
        utm,
        consent,
        honeypot: honeypotRef.current?.value,
        formRenderedAt: formRenderedAtRef.current,
      });
      if (actionResult.status === "error") {
        setSubmitError(actionResult.message);
        setPhase("form");
        return;
      }
      reachGoal("quiz_submitted");
      setResult(actionResult);
      setPhase("result");
    } catch (error) {
      setSubmitError("Не получилось отправить форму. Проверьте соединение и попробуйте снова.");
      setPhase("form");
    }
  }, [consent, currentStep.key, form, isLastStep, sessionId, stepIndex, utm]);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  if (phase === "loading") {
    return <LoadingState />;
  }

  if (phase === "result" && result) {
    return result.status === "success" ? (
      <ResultSuccess leadId={result.leadId} map={result.map} />
    ) : (
      <ResultFallback leadId={result.leadId} message={result.message} />
    );
  }

  const slideOffset = prefersReducedMotion ? 0 : 20;
  const variants = {
    enter: { opacity: 0, x: direction > 0 ? slideOffset : -slideOffset, scale: 0.98 },
    center: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: direction > 0 ? -slideOffset : slideOffset, scale: 0.98 },
  };

  const fieldError = form.formState.errors[currentStep.key];
  const isMaxSubjectsReached = selectedSubjects.length >= 2;

  return (
    <section id="readiness-map" className="relative overflow-hidden pt-16 pb-40 md:py-24 scroll-mt-20">
      <Atmosphere variant="mixed" intensity="premium" />
      <div
        aria-hidden
        className="motion-safe:animate-blob-float-slow pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-rose-300/25 blur-[100px] [will-change:transform] [transform:translateZ(0)]"
      />

      <div className="relative mx-auto max-w-2xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-700">
            <Target className="h-3.5 w-3.5" aria-hidden />
            Персональная диагностика знаний
          </span>
          <h2 className="font-bold tracking-tight text-ink-900 text-balance">
            Соберите Карту готовности к экзаменам 2026
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-ink-600 font-medium">
            Узнайте текущий уровень подготовки ребенка, зафиксируйте проблемные темы и получите
            пошаговый план поступления за 2 минуты.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {TRUST_BADGES.map((badge, i) => (
              <motion.span
                key={badge.label}
                {...floatY(prefersReducedMotion, 3.5 + i * 0.4, 8)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-ink-600 shadow-card backdrop-blur-xl"
              >
                <badge.icon className="h-3.5 w-3.5 text-brand-500" aria-hidden />
                {badge.label}
              </motion.span>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-rose-100/50 bg-white/90 p-8 sm:p-10 md:p-12 shadow-2xl shadow-brand-900/10 backdrop-blur-xl">

          <input type="hidden" {...form.register("grade")} />
          <input type="hidden" {...form.register("subjects")} />
          <input type="hidden" {...form.register("studyStyle")} />
          <input type="hidden" {...form.register("hobbies")} />
          <input type="hidden" {...form.register("deadline")} />
          <input
            type="text"
            ref={honeypotRef}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            name="website"
            className="absolute left-[-9999px] h-px w-px overflow-hidden opacity-0"
          />

          <p className="text-center text-xs font-bold uppercase tracking-wider text-brand-500">
            Шаг {stepIndex + 1} из {STEPS.length}: {currentStep.stepLabel}
          </p>
          <div className="mt-3">
            <ProgressDots total={STEPS.length} current={stepIndex} />
          </div>

          <div className="min-h-[200px] mt-8 sm:mt-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.key}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col"
              >
                <h3 className="font-bold tracking-tight text-ink-900 leading-tight text-balance">
                  {currentStep.title}
                </h3>
                <p className="mt-2 text-sm font-semibold text-ink-600">
                  {currentStep.helper}
                </p>

                <div className="mt-8">
                  {currentStep.key === "grade" && (
                    <div className="grid grid-cols-3 gap-4">
                      {GRADE_OPTIONS.map((option) => {
                        const selected = selectedGrade === option.value;
                        return (
                          <motion.button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => handleGradeSelect(option.value)}
                            whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -3 }}
                            whileTap={{ scale: 0.95 }}
                            className={`relative overflow-hidden rounded-2xl border py-4 text-center font-extrabold text-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ${
                              selected
                                ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm shadow-brand-900/10"
                                : "border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50/40"
                            }`}
                          >
                            {option.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {currentStep.key === "subjects" && (
                    <div className="relative">
                      <div className="grid grid-cols-2 gap-3 max-h-[min(280px,40dvh)] overflow-y-auto overscroll-contain pr-1">
                        {SUBJECT_OPTIONS.map((option) => {
                          const isSelected = selectedSubjects.includes(option.value);
                          const isDisabled = isMaxSubjectsReached && !isSelected;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              disabled={isDisabled}
                              aria-pressed={isSelected}
                              onClick={() => handleSubjectToggle(option.value)}
                              className={`rounded-2xl border px-4 py-3 text-left font-bold text-sm transition-all duration-200 flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 active:scale-95 ${
                                isSelected
                                  ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm shadow-brand-900/10"
                                  : isDisabled
                                    ? "border-ink-100 bg-ink-50 text-ink-400 opacity-40 cursor-not-allowed"
                                    : "border-ink-200 bg-white text-ink-700 hover:border-brand-300"
                              }`}
                            >
                              <span className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                isSelected
                                  ? "border-brand-500 bg-brand-500 text-white"
                                  : isDisabled
                                    ? "border-ink-200 bg-ink-50"
                                    : "border-ink-300 bg-white"
                              }`}>
                                {isSelected && <Check className="w-3 h-3" strokeWidth={3} aria-hidden />}
                              </span>
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
                    </div>
                  )}

                  {currentStep.key === "studyStyle" && (
                    <div className="relative">
                      <div className="flex flex-col gap-3 max-h-[min(280px,40dvh)] overflow-y-auto overscroll-contain pr-1">
                        {STUDY_STYLE_OPTIONS.map((option) => {
                          const isSelected = selectedStudyStyle === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => handleStudyStyleSelect(option.value)}
                              className={`w-full rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 active:scale-98 flex items-center justify-between ${
                                isSelected
                                  ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm shadow-brand-900/10"
                                  : "border-ink-200 bg-white text-ink-700 hover:border-brand-300"
                              }`}
                            >
                              <div className="pr-4">
                                <div className="font-extrabold text-sm sm:text-base text-ink-900">
                                  {option.title}
                                </div>
                                <div className="text-xs text-ink-600 font-medium mt-0.5 leading-tight">
                                  {option.desc}
                                </div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${
                                isSelected
                                  ? "border-brand-500 bg-brand-500 text-white"
                                  : "border-ink-300 bg-white"
                              }`}>
                                {isSelected && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
                    </div>
                  )}

                  {currentStep.key === "hobbies" && (
                    <div className="relative">
                      <div className="grid grid-cols-2 gap-3 max-h-[min(280px,40dvh)] overflow-y-auto overscroll-contain pr-1">
                        {HOBBIES_OPTIONS.map((option) => {
                          const isSelected = selectedHobbies.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => handleHobbyToggle(option.value)}
                              className={`rounded-2xl border px-4 py-3.5 text-left font-bold text-sm transition-all duration-200 flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 active:scale-95 ${
                                isSelected
                                  ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm shadow-brand-900/10"
                                  : "border-ink-200 bg-white text-ink-700 hover:border-brand-300"
                              }`}
                            >
                              <span className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                isSelected
                                  ? "border-brand-500 bg-brand-500 text-white"
                                  : "border-ink-300 bg-white"
                              }`}>
                                {isSelected && <Check className="w-3 h-3" strokeWidth={3} aria-hidden />}
                              </span>
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
                    </div>
                  )}

                  {currentStep.key === "deadline" && (
                    <div className="grid grid-cols-2 gap-4">
                      {DEADLINE_OPTIONS.map((option) => {
                        const selected = selectedDeadline === option.value;
                        return (
                          <motion.button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => handleDeadlineSelect(option.value)}
                            whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -3 }}
                            whileTap={{ scale: 0.95 }}
                            className={`relative overflow-hidden rounded-2xl border py-4 px-3 text-center font-extrabold text-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ${
                              selected
                                ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm shadow-brand-900/10"
                                : "border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50/40"
                            }`}
                          >
                            {option.label}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {currentStep.key !== "grade" &&
                    currentStep.key !== "subjects" &&
                    currentStep.key !== "studyStyle" &&
                    currentStep.key !== "hobbies" &&
                    currentStep.key !== "deadline" && (
                      <div className="relative">
                        <input
                          {...form.register(currentStep.key)}
                          placeholder={currentStep.placeholder}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              goNext();
                            }
                          }}
                          className={`min-h-[44px] w-full rounded-2xl border px-6 py-4 text-base text-ink-900 placeholder:text-ink-400 outline-none transition-all duration-300 ${
                            fieldError
                              ? "border-rose-400/60 bg-rose-50 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                              : "border-ink-200 bg-white focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                          }`}
                        />
                      </div>
                    )}
                </div>

                <div className="min-h-[24px] mt-2">
                  <AnimatePresence initial={false}>
                    {fieldError && (
                      <motion.p
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="text-xs font-bold text-rose-500 flex items-center gap-1.5 pl-1"
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {fieldError.message}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {submitError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-xs font-semibold text-rose-500 text-center"
              >
                {submitError}
              </motion.p>
            )}
          </AnimatePresence>

          {isLastStep && (
            <div className="mt-6">
              <LegalCheckbox
                checked={consent}
                onChange={(value) => {
                  setConsent(value);
                  if (value) setConsentError(false);
                }}
                error={consentError}
                id="readiness-consent"
              />
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-ink-100 pt-6">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="min-h-[44px] flex items-center rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-bold text-ink-700 transition-all duration-200 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-0"
            >
              Назад
            </button>
            <motion.button
              type="button"
              onClick={goNext}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -3 }}
              whileTap={{ scale: 0.95 }}
              className={`group relative flex min-h-[44px] items-center gap-2 overflow-hidden rounded-2xl px-8 py-4 font-black text-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-offset-2 ${
                isLastStep
                  ? "bg-accent-500 text-ink-900 shadow-md shadow-accent-500/25 hover:shadow-lg hover:shadow-accent-500/35 focus-visible:ring-2 focus-visible:ring-accent-300"
                  : "bg-brand-600 text-white shadow-md shadow-brand-900/20 hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400"
              }`}
            >
              {isLastStep ? "Получить карту" : "Далее"}
              <ArrowRight
                className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                strokeWidth={2.5}
                aria-hidden
              />
            </motion.button>
          </div>

        </div>
      </div>
    </section>
  );
}