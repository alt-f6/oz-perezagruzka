"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ConfirmDialog } from "@/crm/components/ConfirmDialog";
import { LessonFormFields } from "@/crm/components/LessonFormFields";
import { Modal } from "@/crm/components/Modal";
import { useToast } from "@/crm/components/ToastProvider";
import { formatTimeRange } from "@/crm/lib/lessonTime";
import { lessonSchema, type LessonValues } from "@/crm/lib/schemas";
import type { ClassSessionWithGroup, Group } from "@/crm/lib/types";
import { formatMoscowDate } from "@/shared/lib/timezone";
import { bulkCancelSessions, createLesson, deleteLesson } from "./actions";

type CancelCandidate =
  | { kind: "single"; lessonId: string }
  | { kind: "series"; recurrenceGroupId: string }
  | { kind: "selection"; sessionIds: string[] };

// Group lessons show the group name; individual lessons fall back to the
// student's name (or a neutral label) now that a session may have no group.
function sessionLabel(lesson: ClassSessionWithGroup): string {
  return lesson.group?.name ?? lesson.student?.fullName ?? "Индивидуальное занятие";
}

// A GROUP session's own teacherId is a snapshot taken at creation time and
// only re-synced onto still-scheduled sessions when the group is reassigned
// (see assignTeacherToGroup/updateGroup) -- a session created before some
// past reassignment, or touched by a path that predates that sync, can carry
// a stale teacherId. The group's CURRENT teacher (teacherNameById, keyed off
// lesson.group.teacherId) is always the source of truth for what's actually
// displayed; the session's own teacher relation is only a fallback for
// INDIVIDUAL sessions (no group) or a group with no teacher assigned.
function getTeacherLabel(
  lesson: ClassSessionWithGroup,
  teacherNameById: Map<string, string>,
): string {
  const liveTeacherId = lesson.group?.teacherId;
  if (liveTeacherId) {
    const liveName = teacherNameById.get(liveTeacherId);
    if (liveName) return liveName;
  }
  return lesson.teacher?.fullName ?? "Без преподавателя";
}

export function LessonsClient({
  initialLessons,
  initialNextCursor,
  groups,
  teachers = [],
  students = [],
  userRole,
}: {
  initialLessons: ClassSessionWithGroup[];
  initialNextCursor: string | null;
  groups: Group[];
  teachers?: { id: string; fullName: string }[];
  students?: { id: string; fullName: string }[];
  userRole?: string;
}) {
  const isTeacher = userRole === "TEACHER";
  const showToast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [trialOnly, setTrialOnly] = useState(false);
  // Set when createLesson reports the chosen time is outside the teacher's
  // declared working hours; drives the override-confirmation dialog so the
  // lesson is never created silently against unavailability.
  const [availabilityWarning, setAvailabilityWarning] = useState<{
    occurrences: { scheduledAt: string; label: string }[];
    values: LessonValues;
  } | null>(null);
  // Set when createLesson reports a backfilled past occurrence lands in a
  // month whose payout period is already closed for the resolved teacher.
  const [closedPayoutWarning, setClosedPayoutWarning] = useState<{
    occurrences: { scheduledAt: string; label: string }[];
    values: LessonValues;
  } | null>(null);
  // Set when createLesson reports the chosen student has no individual-lesson
  // price history; the operator must explicitly confirm creating at 0 ₽.
  const [missingPriceWarning, setMissingPriceWarning] = useState<{
    studentName: string;
    values: LessonValues;
  } | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cancelCandidate, setCancelCandidate] = useState<CancelCandidate | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [lessons, setLessons] = useState(initialLessons);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const teacherNameById = useMemo(
    () => new Map(teachers.map((t) => [t.id, t.fullName])),
    [teachers],
  );

  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/crm/api/lessons?cursor=${nextCursor}`);
      if (!res.ok) throw new Error("request failed");
      const json = await res.json();
      if (!json.ok) throw new Error("request failed");
      setLessons((prev) => [...prev, ...json.lessons]);
      setNextCursor(json.nextCursor);
    } catch {
      showToast("Не удалось загрузить занятия", "error");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LessonValues>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      type: "GROUP",
      groupId: "",
      studentId: "",
      teacherId: "",
      recurrence: "NONE",
      recurrenceDays: [],
      durationMinutes: 60,
    },
  });

  // Returns true when the lesson was actually created. `ack` re-submits past
  // whichever soft warning the operator just confirmed.
  const submitCreate = async (
    values: LessonValues,
    ack: { unavailable?: boolean; closedPayout?: boolean; missingPrice?: boolean } = {},
  ): Promise<boolean> => {
    const result = await createLesson({
      ...values,
      ...(ack.unavailable ? { acknowledgeUnavailable: true } : {}),
      ...(ack.closedPayout ? { acknowledgeClosedPayout: true } : {}),
      ...(ack.missingPrice ? { acknowledgeMissingPrice: true } : {}),
    });
    if (result?.error) {
      showToast(result.error, "error");
      return false;
    }
    // missingPriceWarning is checked before the other two: createLesson
    // returns it from inside the INDIVIDUAL branch, before occurrences are
    // even expanded, so it's always the first warning surfaced.
    if ("missingPriceWarning" in result && result.missingPriceWarning) {
      setMissingPriceWarning({
        studentName: result.missingPriceWarning.studentName,
        values,
      });
      return false;
    }
    // Closed-payout is checked before availability server-side, so surface it
    // first here too -- an operator overriding one warning may still hit the
    // other on the next submit.
    if ("closedPayoutWarning" in result && result.closedPayoutWarning) {
      setClosedPayoutWarning({
        occurrences: result.closedPayoutWarning.occurrences,
        values,
      });
      return false;
    }
    if ("availabilityWarning" in result && result.availabilityWarning) {
      setAvailabilityWarning({
        occurrences: result.availabilityWarning.occurrences,
        values,
      });
      return false;
    }
    showToast(
      values.recurrence === "NONE" ? "Занятие создано" : "Занятия созданы",
    );
    reset();
    setIsModalOpen(false);
    return true;
  };

  const onSubmit = async (values: LessonValues) => {
    try {
      await submitCreate(values);
    } catch {
      showToast("Не удалось создать занятие", "error");
    }
  };

  const confirmOverrideAvailability = async () => {
    if (!availabilityWarning) return;
    setOverriding(true);
    try {
      const created = await submitCreate(availabilityWarning.values, { unavailable: true });
      if (created) setAvailabilityWarning(null);
    } catch {
      showToast("Не удалось создать занятие", "error");
    } finally {
      setOverriding(false);
    }
  };

  const confirmOverrideClosedPayout = async () => {
    if (!closedPayoutWarning) return;
    setOverriding(true);
    try {
      const created = await submitCreate(closedPayoutWarning.values, { closedPayout: true });
      if (created) setClosedPayoutWarning(null);
    } catch {
      showToast("Не удалось создать занятие", "error");
    } finally {
      setOverriding(false);
    }
  };

  const confirmOverrideMissingPrice = async () => {
    if (!missingPriceWarning) return;
    setOverriding(true);
    try {
      const created = await submitCreate(missingPriceWarning.values, { missingPrice: true });
      if (created) setMissingPriceWarning(null);
    } catch {
      showToast("Не удалось создать занятие", "error");
    } finally {
      setOverriding(false);
    }
  };

  const visibleLessons = useMemo(
    () => lessons.filter((l) => (showCancelled || l.status !== "cancelled") && (!trialOnly || l.isTrial)),
    [lessons, showCancelled, trialOnly],
  );

  const toggleSelected = (lessonId: string) => {
    setSelectedIds((prev) =>
      prev.includes(lessonId) ? prev.filter((id) => id !== lessonId) : [...prev, lessonId],
    );
  };

  const runCancellation = async (reason?: string) => {
    if (!cancelCandidate) return;
    void reason; // collected for operator context; not yet persisted (see design doc follow-ups)
    setIsCancelling(true);
    try {
      const result =
        cancelCandidate.kind === "single"
          ? await deleteLesson(cancelCandidate.lessonId)
          : cancelCandidate.kind === "series"
            ? await bulkCancelSessions({ recurrenceGroupId: cancelCandidate.recurrenceGroupId })
            : await bulkCancelSessions({ sessionIds: cancelCandidate.sessionIds });

      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Занятия отменены");
        setSelectedIds([]);
      }
    } catch {
      showToast("Не удалось отменить занятия", "error");
    } finally {
      setIsCancelling(false);
      setCancelCandidate(null);
    }
  };

  const dialogCopy = (() => {
    if (!cancelCandidate) return { title: "", message: "" };
    if (cancelCandidate.kind === "single") {
      const target = lessons.find((l) => l.id === cancelCandidate.lessonId);
      const isPastLesson = target ? new Date(target.scheduledAt) <= new Date() : false;
      return {
        title: "Отменить занятие?",
        message: isPastLesson
          ? "Занятие уже прошло. Отмена уберёт его из расписания и списка занятий."
          : "Прошедшие занятия затронуты не будут.",
      };
    }
    if (cancelCandidate.kind === "series") {
      return {
        title: "Отменить оставшиеся занятия серии?",
        message: "Будут отменены все предстоящие занятия этой серии. Прошедшие занятия затронуты не будут.",
      };
    }
    return {
      title: "Отменить выбранные занятия?",
      message: `Будет отменено занятий: ${cancelCandidate.sessionIds.length}. Прошедшие занятия затронуты не будут.`,
    };
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Занятия</h1>
          <p className="page-subtitle">
            Все уроки школы и переход к посещаемости
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
              aria-label="Показать отменённые"
            />
            Показать отменённые
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={trialOnly}
              onChange={(e) => setTrialOnly(e.target.checked)}
              aria-label="Только пробные уроки"
            />
            Только пробные
          </label>
          {!isTeacher && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="btn-primary"
            >
              <Plus size={16} />
              Новое занятие
            </button>
          )}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3">
          <p className="text-sm font-medium text-slate-700">
            Выбрано занятий: {selectedIds.length}
          </p>
          <button
            type="button"
            onClick={() => setCancelCandidate({ kind: "selection", sessionIds: selectedIds })}
            className="btn-danger px-3.5 py-2 text-xs"
          >
            Отменить выбранные ({selectedIds.length})
          </button>
        </div>
      )}

      {visibleLessons.length === 0 ? (
        <div className="empty-state">
          <CalendarDays size={28} className="text-slate-300" />
          <p className="font-medium text-slate-600">Пока нет занятий</p>
          <p>Запланируйте первое занятие</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleLessons.map((lesson) => {
            const isCancelled = lesson.status === "cancelled";
            const isFuture = new Date(lesson.scheduledAt) > new Date();
            return (
              <motion.div
                key={lesson.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`card card-hover flex items-center justify-between gap-4 p-4 ${
                  isCancelled ? "opacity-50" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  {!isCancelled && isFuture && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(lesson.id)}
                      onChange={() => toggleSelected(lesson.id)}
                      aria-label={`Выбрать занятие ${sessionLabel(lesson)}`}
                    />
                  )}
                  <div className="icon-tile h-11 w-11 bg-slate-100 text-slate-600">
                    <CalendarDays size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-tight text-slate-900">
                      {sessionLabel(lesson)}
                      {isCancelled && (
                        <span className="badge-neutral ml-2 align-middle">Отменено</span>
                      )}
                      {lesson.isTrial && (
                        <span className="badge-warning ml-2 inline-flex items-center gap-1 align-middle">
                          <Sparkles size={11} className="shrink-0" />
                          ПРОБНЫЙ УРОК
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {formatMoscowDate(lesson.scheduledAt)},{" "}
                      {formatTimeRange({
                        scheduledAt: lesson.scheduledAt,
                        durationMinutes: lesson.durationMinutes,
                      })}
                    </p>
                    <span className="badge-info mt-1 gap-1 px-1.5 py-0 text-[11px]">
                      <GraduationCap size={12} className="shrink-0" />
                      {getTeacherLabel(lesson, teacherNameById)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!isCancelled && isFuture && lesson.recurrenceGroupId && (
                    <button
                      type="button"
                      onClick={() =>
                        setCancelCandidate({
                          kind: "series",
                          recurrenceGroupId: lesson.recurrenceGroupId as string,
                        })
                      }
                      className="icon-btn-danger"
                      title="Отменить оставшиеся занятия серии"
                    >
                      <Repeat size={16} />
                    </button>
                  )}
                  {!isCancelled && (
                    <button
                      type="button"
                      onClick={() => setCancelCandidate({ kind: "single", lessonId: lesson.id })}
                      className="icon-btn-danger"
                      title="Отменить занятие"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <Link
                    href={`/lessons/${lesson.id}`}
                    className="btn-secondary px-3.5 py-2 text-xs"
                  >
                    Посещаемость
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center">
          <button onClick={loadMore} disabled={isLoadingMore} className="btn-secondary">
            {isLoadingMore ? "Загрузка..." : "Показать ещё"}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={cancelCandidate !== null}
        title={dialogCopy.title}
        message={dialogCopy.message}
        confirmLabel="Отменить"
        danger
        busy={isCancelling}
        reasonLabel={cancelCandidate?.kind !== "single" ? "Причина отмены" : undefined}
        reasonPlaceholder="Например: отпуск преподавателя"
        onConfirm={runCancellation}
        onClose={() => setCancelCandidate(null)}
      />

      {!isTeacher && (
      <Modal
        open={isModalOpen}
        title="Новое занятие"
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <LessonFormFields
            register={register}
            watch={watch}
            setValue={setValue}
            errors={errors}
            groups={groups}
            teachers={teachers}
            students={students}
            isSubmitting={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full"
          >
            {isSubmitting ? "Создание..." : "Создать"}
          </button>
        </form>
      </Modal>
      )}

      <ConfirmDialog
        open={availabilityWarning !== null}
        danger
        title="Преподаватель не отметил это время рабочим"
        confirmLabel="Всё равно создать"
        busy={overriding}
        message={
          <span>
            Внимание: преподаватель не отметил этот слот как рабочий:
            <br />
            {(availabilityWarning?.occurrences ?? []).map((o) => (
              <span key={o.scheduledAt} className="mt-1 block font-medium text-slate-800">
                • {o.label}
              </span>
            ))}
          </span>
        }
        onConfirm={confirmOverrideAvailability}
        onClose={() => setAvailabilityWarning(null)}
      />

      <ConfirmDialog
        open={closedPayoutWarning !== null}
        danger
        title="Расчётный период уже закрыт"
        confirmLabel="Всё равно создать"
        busy={overriding}
        message={
          <span>
            Внимание: для этого преподавателя уже зафиксирована выплата за месяц,
            в который попадают эти занятия — создание задним числом изменит начисления
            за уже закрытый период:
            <br />
            {(closedPayoutWarning?.occurrences ?? []).map((o) => (
              <span key={o.scheduledAt} className="mt-1 block font-medium text-slate-800">
                • {o.label}
              </span>
            ))}
          </span>
        }
        onConfirm={confirmOverrideClosedPayout}
        onClose={() => setClosedPayoutWarning(null)}
      />

      <ConfirmDialog
        open={missingPriceWarning !== null}
        danger
        title="У ученика нет истории цены"
        confirmLabel="Создать с ценой 0 ₽"
        busy={overriding}
        message={
          <span>
            Для ученика «{missingPriceWarning?.studentName}» ещё нет ни одного
            индивидуального занятия с ценой — стоимость нового занятия будет
            установлена в 0 ₽. Скорректировать её можно позже.
          </span>
        }
        onConfirm={confirmOverrideMissingPrice}
        onClose={() => setMissingPriceWarning(null)}
      />
    </div>
  );
}
