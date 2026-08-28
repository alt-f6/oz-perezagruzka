"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { CalendarDays, ChevronRight, Plus, Repeat, Trash2 } from "lucide-react";
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
import { bulkCancelSessions, createLesson, deleteLesson } from "./actions";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" });

type CancelCandidate =
  | { kind: "single"; lessonId: string }
  | { kind: "series"; recurrenceGroupId: string }
  | { kind: "selection"; sessionIds: string[] };

export function LessonsClient({
  initialLessons,
  initialNextCursor,
  groups,
  userRole,
}: {
  initialLessons: ClassSessionWithGroup[];
  initialNextCursor: string | null;
  groups: Group[];
  userRole?: string;
}) {
  const isTeacher = userRole === "TEACHER";
  const showToast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cancelCandidate, setCancelCandidate] = useState<CancelCandidate | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [lessons, setLessons] = useState(initialLessons);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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
    defaultValues: { recurrence: "NONE", recurrenceDays: [], durationMinutes: 60 },
  });

  const onSubmit = async (values: LessonValues) => {
    try {
      const result = await createLesson(values);

      if (result?.error) {
        showToast(result.error, "error");
        return;
      }

      showToast(
        values.recurrence === "NONE" ? "Занятие создано" : "Занятия созданы",
      );
      reset();
      setIsModalOpen(false);
    } catch {
      showToast("Не удалось создать занятие", "error");
    }
  };

  const visibleLessons = useMemo(
    () => lessons.filter((l) => showCancelled || l.status !== "cancelled"),
    [lessons, showCancelled],
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
      return {
        title: "Отменить занятие?",
        message: "Прошедшие занятия затронуты не будут.",
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
                      aria-label={`Выбрать занятие ${lesson.group.name}`}
                    />
                  )}
                  <div className="icon-tile h-11 w-11 bg-slate-100 text-slate-600">
                    <CalendarDays size={19} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-tight text-slate-900">
                      {lesson.group.name}
                      {isCancelled && (
                        <span className="badge-neutral ml-2 align-middle">Отменено</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {dateFormatter.format(new Date(lesson.scheduledAt))},{" "}
                      {formatTimeRange({
                        scheduledAt: lesson.scheduledAt,
                        durationMinutes: lesson.durationMinutes,
                      })}
                    </p>
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
                  {!isCancelled && isFuture && (
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
    </div>
  );
}
