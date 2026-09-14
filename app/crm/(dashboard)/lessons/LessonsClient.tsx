"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ConfirmDialog } from "@/crm/components/ConfirmDialog";
import { LessonAttendanceBadge } from "@/crm/components/LessonAttendanceBadge";
import { LessonFormFields } from "@/crm/components/LessonFormFields";
import { LessonsFilterToolbar } from "@/crm/components/LessonsFilterToolbar";
import { Modal } from "@/crm/components/Modal";
import { ReassignTeacherModal } from "@/crm/components/ReassignTeacherModal";
import { useToast } from "@/crm/components/ToastProvider";
import { buildLessonsQuery } from "@/crm/lib/lessonFilters";
import { formatTimeRange } from "@/crm/lib/lessonTime";
import { lessonSchema, type LessonListFilters, type LessonValues } from "@/crm/lib/schemas";
import type { LessonListRow } from "@/crm/lib/services/lesson-list.service";
import type { Group } from "@/crm/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { formatMoscowDate } from "@/shared/lib/timezone";
import {
  bulkCancelSessions,
  bulkCancelSessionsWithBilling,
  createLesson,
  deleteLesson,
  reassignTeacher,
} from "./actions";

type CancelCandidate =
  | { kind: "single"; lessonId: string }
  | { kind: "series"; recurrenceGroupId: string }
  | { kind: "selection"; sessionIds: string[] };

function sessionLabel(lesson: LessonListRow): string {
  return lesson.group?.name ?? lesson.student?.fullName ?? "Индивидуальное занятие";
}

// A GROUP session's own teacherId is a creation-time snapshot, only re-synced
// onto still-scheduled sessions when the group is reassigned -- the group's
// CURRENT teacher (lesson.group.teacherId) is always the source of truth for
// what's actually displayed; the session's own teacher is only a fallback for
// an INDIVIDUAL session or a group with no teacher assigned.
function getTeacherLabel(lesson: LessonListRow, teacherNameById: Map<string, string>): string {
  const liveTeacherId = lesson.group?.teacherId;
  if (liveTeacherId) {
    const liveName = teacherNameById.get(liveTeacherId);
    if (liveName) return liveName;
  }
  return lesson.teacher?.fullName ?? "Без преподавателя";
}

export function LessonsClient({
  initialLessons,
  initialTotal,
  initialFilters,
  groups,
  teachers = [],
  students = [],
  userRole,
}: {
  initialLessons: LessonListRow[];
  initialTotal: number;
  initialFilters: LessonListFilters;
  groups: Group[];
  teachers?: { id: string; fullName: string }[];
  students?: { id: string; fullName: string }[];
  userRole?: string;
}) {
  const isTeacher = userRole === "TEACHER";
  const showToast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Data flows down as props: navigating (router.replace) re-runs the parent
  // Server Component with fresh searchParams, which passes fresh
  // initialLessons/initialTotal/initialFilters here. No client-side
  // duplicate-fetch layer is needed for filtering/paging.
  const lessons = initialLessons;
  const total = initialTotal;
  const filters = initialFilters;

  const searchParamsKey = searchParams.toString();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionResetKey, setSelectionResetKey] = useState(searchParamsKey);
  // Clears any stale selection whenever the visible page/filter changes.
  // Comparing during render (instead of in an effect) lets React apply the
  // reset synchronously before committing, avoiding an extra render pass.
  if (searchParamsKey !== selectionResetKey) {
    setSelectionResetKey(searchParamsKey);
    setSelectedIds([]);
  }

  const updateQuery = (patch: Record<string, string | null>) => {
    const current = Object.fromEntries(searchParams.entries());
    const next = buildLessonsQuery(current, patch);
    const qs = new URLSearchParams(next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const goToPage = (page: number) => updateQuery({ page: String(page) });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availabilityWarning, setAvailabilityWarning] = useState<{
    occurrences: { scheduledAt: string; label: string }[];
    values: LessonValues;
  } | null>(null);
  const [closedPayoutWarning, setClosedPayoutWarning] = useState<{
    occurrences: { scheduledAt: string; label: string }[];
    values: LessonValues;
  } | null>(null);
  const [missingPriceWarning, setMissingPriceWarning] = useState<{
    studentName: string;
    values: LessonValues;
  } | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [cancelCandidate, setCancelCandidate] = useState<CancelCandidate | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);

  const teacherNameById = useMemo(() => new Map(teachers.map((t) => [t.id, t.fullName])), [teachers]);

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
    if ("missingPriceWarning" in result && result.missingPriceWarning) {
      setMissingPriceWarning({ studentName: result.missingPriceWarning.studentName, values });
      return false;
    }
    if ("closedPayoutWarning" in result && result.closedPayoutWarning) {
      setClosedPayoutWarning({ occurrences: result.closedPayoutWarning.occurrences, values });
      return false;
    }
    if ("availabilityWarning" in result && result.availabilityWarning) {
      setAvailabilityWarning({ occurrences: result.availabilityWarning.occurrences, values });
      return false;
    }
    showToast(values.recurrence === "NONE" ? "Занятие создано" : "Занятия созданы");
    reset();
    setIsModalOpen(false);
    router.refresh();
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

  const toggleSelected = (lessonId: string) => {
    setSelectedIds((prev) => (prev.includes(lessonId) ? prev.filter((id) => id !== lessonId) : [...prev, lessonId]));
  };

  const selectableIds = useMemo(
    () => lessons.filter((l) => l.status === "scheduled" && new Date(l.scheduledAt) > new Date()).map((l) => l.id),
    [lessons],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
  const someSelected = selectedIds.length > 0 && !allSelected;
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : selectableIds);

  const runCancellation = async (reason?: string) => {
    if (!cancelCandidate) return;
    setIsCancelling(true);
    try {
      const result =
        cancelCandidate.kind === "single"
          ? await deleteLesson(cancelCandidate.lessonId)
          : cancelCandidate.kind === "series"
            ? await bulkCancelSessions({ recurrenceGroupId: cancelCandidate.recurrenceGroupId })
            : await bulkCancelSessionsWithBilling({ sessionIds: cancelCandidate.sessionIds, reason: reason ?? "" });

      if (result?.error) {
        showToast(result.error, "error");
      } else {
        const hasCounts = result !== undefined && "cancelledCount" in result;
        showToast(
          hasCounts && result.skippedCount > 0
            ? `Отменено: ${result.cancelledCount}, пропущено: ${result.skippedCount}`
            : "Занятия отменены",
        );
        setSelectedIds([]);
        router.refresh();
      }
    } catch {
      showToast("Не удалось отменить занятия", "error");
    } finally {
      setIsCancelling(false);
      setCancelCandidate(null);
    }
  };

  const runReassign = async (newTeacherId: string) => {
    setIsReassigning(true);
    try {
      const result = await reassignTeacher({ sessionIds: selectedIds, newTeacherId });
      if (!("reassignedCount" in result)) {
        showToast(result.error, "error");
      } else {
        showToast(
          result.skippedCount > 0
            ? `Перенесено: ${result.reassignedCount}, пропущено из-за конфликтов: ${result.skippedCount}`
            : `Преподаватель изменён у ${result.reassignedCount} занятий`,
        );
        setSelectedIds([]);
        setIsReassignOpen(false);
        router.refresh();
      }
    } catch {
      showToast("Не удалось сменить преподавателя", "error");
    } finally {
      setIsReassigning(false);
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
      message: `Будет отменено занятий: ${cancelCandidate.sessionIds.length}. Списания будут возвращены на баланс.`,
    };
  })();

  const pageStart = total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const pageEnd = Math.min(filters.page * filters.pageSize, total);
  const hasNextPage = filters.page * filters.pageSize < total;
  const hasPrevPage = filters.page > 1;

  return (
    <div className="min-w-0 w-full space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Занятия</h1>
          <p className="page-subtitle">Все уроки школы и переход к посещаемости</p>
        </div>
        {!isTeacher && (
          <button type="button" onClick={() => setIsModalOpen(true)} className="btn-primary">
            <Plus size={16} />
            Новое занятие
          </button>
        )}
      </div>

      <LessonsFilterToolbar filters={filters} teachers={teachers} isTeacher={isTeacher} onChange={updateQuery} />

      {!isTeacher && selectedIds.length > 0 && (
        <div className="sticky top-2 z-20 flex items-center justify-between rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-slate-700">Выбрано: {selectedIds.length}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCancelCandidate({ kind: "selection", sessionIds: selectedIds })}
              className="btn-danger px-3.5 py-2 text-xs"
            >
              Отменить выбранные
            </button>
            <button type="button" onClick={() => setIsReassignOpen(true)} className="btn-secondary px-3.5 py-2 text-xs">
              Сменить преподавателя
            </button>
            <button type="button" onClick={() => setSelectedIds([])} className="btn-secondary px-3.5 py-2 text-xs">
              Снять выделение
            </button>
          </div>
        </div>
      )}

      {lessons.length === 0 ? (
        <div className="empty-state">
          <CalendarDays size={28} className="text-slate-300" />
          <p className="font-medium text-slate-600">Занятий не найдено</p>
          <p>Измените фильтры или запланируйте новое занятие</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {!isTeacher && (
                <TableHead className="w-10">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Выбрать все занятия"
                  />
                </TableHead>
              )}
              <TableHead>Занятие</TableHead>
              <TableHead>Дата и время</TableHead>
              <TableHead>Преподаватель</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.map((lesson) => {
              const isCancelled = lesson.status === "cancelled";
              const isFuture = new Date(lesson.scheduledAt) > new Date();
              const profileHref = lesson.groupId
                ? `/groups/${lesson.groupId}`
                : lesson.studentId
                  ? `/students/${lesson.studentId}`
                  : null;
              return (
                <TableRow key={lesson.id} className={isCancelled ? "opacity-50" : undefined}>
                  {!isTeacher && (
                    <TableCell>
                      {!isCancelled && isFuture && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(lesson.id)}
                          onChange={() => toggleSelected(lesson.id)}
                          aria-label={`Выбрать занятие ${sessionLabel(lesson)}`}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {profileHref ? (
                        <Link href={profileHref} className="truncate font-semibold text-slate-900 hover:underline">
                          {sessionLabel(lesson)}
                        </Link>
                      ) : (
                        <span className="truncate font-semibold text-slate-900">{sessionLabel(lesson)}</span>
                      )}
                      {lesson.groupId && (
                        <span className="badge-neutral inline-flex items-center gap-1 text-[11px]">
                          <Users size={11} />
                          {lesson.group?.studentCount ?? 0}
                        </span>
                      )}
                      {lesson.isTrial && (
                        <span className="badge-warning inline-flex items-center gap-1 text-[11px]">
                          <Sparkles size={11} className="shrink-0" />
                          [Пробный урок]
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-600">
                      {formatMoscowDate(lesson.scheduledAt)},{" "}
                      {formatTimeRange({ scheduledAt: lesson.scheduledAt, durationMinutes: lesson.durationMinutes })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="badge-info inline-flex items-center gap-1 text-[11px]">
                      <GraduationCap size={12} className="shrink-0" />
                      {getTeacherLabel(lesson, teacherNameById)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/lessons/${lesson.id}`}>
                      <LessonAttendanceBadge
                        status={lesson.attendanceStatus}
                        enrolledCount={lesson.enrolledCount}
                        markedCount={lesson.markedCount}
                      />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex shrink-0 items-center justify-end gap-1.5">
                      {!isTeacher && !isCancelled && isFuture && lesson.recurrenceGroupId && (
                        <button
                          type="button"
                          onClick={() =>
                            setCancelCandidate({ kind: "series", recurrenceGroupId: lesson.recurrenceGroupId as string })
                          }
                          className="icon-btn-danger"
                          title="Отменить оставшиеся занятия серии"
                        >
                          <Repeat size={16} />
                        </button>
                      )}
                      {!isTeacher && !isCancelled && (
                        <button
                          type="button"
                          onClick={() => setCancelCandidate({ kind: "single", lessonId: lesson.id })}
                          className="icon-btn-danger"
                          title="Отменить занятие"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <Link href={`/lessons/${lesson.id}`} className="btn-secondary px-3.5 py-2 text-xs">
                        Посещаемость
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <p>
            Показано {pageStart}–{pageEnd} из {total} занятий
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(filters.page - 1)}
              disabled={!hasPrevPage}
              className="icon-btn disabled:opacity-40"
              aria-label="Предыдущая страница"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => goToPage(filters.page + 1)}
              disabled={!hasNextPage}
              className="icon-btn disabled:opacity-40"
              aria-label="Следующая страница"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={cancelCandidate !== null}
        title={dialogCopy.title}
        message={dialogCopy.message}
        confirmLabel="Отменить"
        danger
        busy={isCancelling}
        reasonLabel={cancelCandidate?.kind === "selection" ? "Причина отмены" : undefined}
        reasonPlaceholder="Например: отпуск преподавателя"
        onConfirm={runCancellation}
        onClose={() => setCancelCandidate(null)}
      />

      <ReassignTeacherModal
        open={isReassignOpen}
        sessionCount={selectedIds.length}
        teachers={teachers}
        busy={isReassigning}
        onConfirm={runReassign}
        onClose={() => setIsReassignOpen(false)}
      />

      {!isTeacher && (
        <Modal open={isModalOpen} title="Новое занятие" onClose={() => setIsModalOpen(false)}>
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
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
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
