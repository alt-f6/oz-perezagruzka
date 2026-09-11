"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Calendar as CalendarIcon,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { LessonWizard } from "@/crm/components/LessonWizard";
import { ConfirmDialog } from "@/crm/components/ConfirmDialog";
import { Modal } from "@/crm/components/Modal";
import { TimezoneBadge } from "@/crm/components/TimezoneBadge";
import { useToast } from "@/crm/components/ToastProvider";
import { assignOverlapColumns } from "@/crm/lib/calendarLayout";
import {
  addDays,
  parseDateKey,
  startOfMonth,
  startOfWeekMonday,
  toDateKey,
} from "@/crm/lib/calendarGrid";
import { formatTimeRange } from "@/crm/lib/lessonTime";
import { lessonSchema, type LessonValues } from "@/crm/lib/schemas";
import { moscowDateKey, moscowWallClock } from "@/shared/lib/timezone";
import { createLesson } from "../lessons/actions";

export const PIXELS_PER_HOUR = 64;
// Floor so short lessons (durationMinutes is user-set, not fixed at 60) still
// have room to render title+time on one compact line plus the teacher badge
// on a second, without clipping. A 30-min lesson would otherwise be only
// 32px tall — not enough for two lines at these font sizes. This is a small,
// bounded visual approximation: very short lessons render slightly taller
// than their exact time-proportional height.
const MIN_SESSION_BLOCK_HEIGHT = 40;

export interface ScheduleLesson {
  id: string;
  type?: "GROUP" | "INDIVIDUAL";
  scheduledAt: string;
  groupId: string | null;
  studentId?: string | null;
  teacherId: string;
  status: string;
  durationMinutes: number;
  isTrial?: boolean;
  group?: { id: string; name: string } | null;
  student?: { id: string; fullName: string } | null;
  teacher?: { fullName: string } | null;
}

export interface ScheduleGroup {
  id: string;
  name: string;
  teacherId?: string | null;
  studentIds?: string[];
}

export interface ScheduleTeacher {
  id: string;
  fullName: string;
}

export interface ScheduleStudent {
  id: string;
  fullName: string;
}

type ViewMode = "day" | "week" | "month";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

// Group lessons show the group name; individual lessons show the student's name
// (with a "1-на-1" hint) instead of the removed "Без группы" placeholder.
function getSessionLabel(lesson: ScheduleLesson): string {
  if (lesson.group?.name) return lesson.group.name;
  if (lesson.student?.fullName) return `${lesson.student.fullName} · 1-на-1`;
  return "Индивидуальное занятие";
}

// A GROUP session's own teacherId is a snapshot taken at creation time and
// only re-synced onto still-scheduled sessions when the group is reassigned
// (see assignTeacherToGroup/updateGroup) -- a session created before some
// past reassignment, or touched by a path that predates that sync, can carry
// a stale teacherId even though the group itself now points at a different
// teacher. The group's CURRENT teacher (via groupTeacherById/teacherNameById,
// keyed off lesson.groupId) is always the source of truth for what's
// displayed; the session's own teacher relation is only a fallback for
// INDIVIDUAL sessions (no group) or a group with no teacher assigned.
function getTeacherLabel(
  lesson: ScheduleLesson,
  groupTeacherById: Map<string, string | null | undefined>,
  teacherNameById: Map<string, string>,
): string {
  const liveTeacherId = lesson.groupId
    ? groupTeacherById.get(lesson.groupId)
    : null;
  if (liveTeacherId) {
    const liveName = teacherNameById.get(liveTeacherId);
    if (liveName) return liveName;
  }
  return lesson.teacher?.fullName ?? "Без преподавателя";
}

export function ScheduleClient({
  lessons,
  groups,
  teachers,
  students = [],
  userRole,
  loadError = null,
}: {
  lessons: ScheduleLesson[];
  groups: ScheduleGroup[];
  teachers: ScheduleTeacher[];
  students?: ScheduleStudent[];
  userRole?: string;
  // Set when the server-side data load failed. Renders a local, non-fatal
  // error state — the session is untouched and never redirected to login.
  loadError?: string | null;
}) {
  const isTeacher = userRole === "TEACHER";
  const showToast = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(toDateKey(new Date()));
  const [view, setView] = useState<ViewMode>("day");
  const [groupFilter, setGroupFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
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
  const [overriding, setOverriding] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
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
      daySlots: [],
    },
  });

  // Returns true when the lesson was actually created. `ack` re-submits past
  // whichever soft warning the operator just confirmed.
  const submitCreate = async (
    values: LessonValues,
    ack: { unavailable?: boolean; closedPayout?: boolean } = {},
  ): Promise<boolean> => {
    const result = await createLesson({
      ...values,
      ...(ack.unavailable ? { acknowledgeUnavailable: true } : {}),
      ...(ack.closedPayout ? { acknowledgeClosedPayout: true } : {}),
    });
    if (result?.error) {
      showToast(result.error, "error");
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

  // Maps a group's id to its roster (student ids), so a group session can be
  // matched against the selected student even though ScheduleLesson only
  // carries the group's id/name, not its full roster.
  const groupRosterById = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const group of groups) {
      map.set(group.id, new Set(group.studentIds ?? []));
    }
    return map;
  }, [groups]);

  const groupTeacherById = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    for (const group of groups) {
      map.set(group.id, group.teacherId);
    }
    return map;
  }, [groups]);

  const teacherNameById = useMemo(
    () => new Map(teachers.map((t) => [t.id, t.fullName])),
    [teachers],
  );

  const studentOptions = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.fullName.toLowerCase().includes(q));
  }, [students, studentQuery]);

  const filteredLessons = useMemo(
    () =>
      lessons.filter(
        (l) =>
          (!groupFilter || l.groupId === groupFilter) &&
          (!teacherFilter || l.teacherId === teacherFilter) &&
          (showCancelled || l.status !== "cancelled") &&
          (!trialOnly || l.isTrial) &&
          (!studentFilter ||
            l.studentId === studentFilter ||
            (l.groupId != null &&
              (groupRosterById.get(l.groupId)?.has(studentFilter) ?? false))),
      ),
    [
      lessons,
      groupFilter,
      teacherFilter,
      showCancelled,
      trialOnly,
      studentFilter,
      groupRosterById,
    ],
  );

  const lessonsByDay = useMemo(() => {
    const map = new Map<string, ScheduleLesson[]>();
    for (const lesson of filteredLessons) {
      if (!lesson.scheduledAt) continue;
      // Bucket by the Moscow calendar day (not the ambient/server-local day):
      // a lesson at 21:30 UTC is 00:30 the next day in Moscow, and must land
      // under that next-day column/cell, matching the Moscow-pinned label
      // shown on the card and the day-view position math below.
      const key = moscowDateKey(lesson.scheduledAt);
      const bucket = map.get(key) ?? [];
      bucket.push(lesson);
      map.set(key, bucket);
    }
    for (const bucket of map.values()) {
      bucket.sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
    }
    return map;
  }, [filteredLessons]);

  const changeDate = (days: number) => {
    const d = parseDateKey(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(toDateKey(d));
  };

  const navigate = (direction: 1 | -1) => {
    if (view === "day") changeDate(direction);
    else if (view === "week") changeDate(direction * 7);
    else {
      const d = parseDateKey(selectedDate);
      d.setMonth(d.getMonth() + direction);
      setSelectedDate(toDateKey(d));
    }
  };

  const selected = parseDateKey(selectedDate);
  const dayLessons = lessonsByDay.get(selectedDate) ?? [];
  const weekStart = startOfWeekMonday(selected);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthGridStart = startOfWeekMonday(startOfMonth(selected));
  const monthDays = Array.from({ length: 42 }, (_, i) =>
    addDays(monthGridStart, i),
  );
  const currentMonth = selected.getMonth();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">Расписание занятий</h1>
          <p className="page-subtitle">
            Календарь уроков и фиксация посещаемости
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/schedule/availability" className="btn-secondary">
            <CalendarClock size={16} />
            {isTeacher ? "Моя доступность" : "Доступность"}
          </Link>
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

      {loadError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-secondary shrink-0 self-start sm:self-auto"
          >
            Обновить
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            onClick={() => navigate(-1)}
            className="icon-btn h-8 w-8"
            type="button"
          >
            <ChevronLeft size={17} />
          </button>
          <div className="flex items-center gap-2 px-2.5 text-sm font-semibold text-slate-900">
            <CalendarIcon size={15} className="text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="cursor-pointer bg-transparent outline-none"
            />
          </div>
          <button
            onClick={() => navigate(1)}
            className="icon-btn h-8 w-8"
            type="button"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                view === mode
                  ? "bg-accent text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {mode === "day" ? "День" : mode === "week" ? "Неделя" : "Месяц"}
            </button>
          ))}
        </div>

        <TimezoneBadge />

        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="input w-auto py-2 shadow-sm"
        >
          <option value="">Все группы</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>

        <select
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
          className="input w-auto py-2 shadow-sm"
        >
          <option value="">Все преподаватели</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.fullName}
            </option>
          ))}
        </select>

        <input
          type="search"
          placeholder="Поиск ученика..."
          value={studentQuery}
          onChange={(e) => setStudentQuery(e.target.value)}
          className="input w-36 py-2 shadow-sm"
          aria-label="Поиск ученика"
        />

        <select
          value={studentFilter}
          onChange={(e) => setStudentFilter(e.target.value)}
          className="input w-auto py-2 shadow-sm"
          aria-label="Фильтр по ученику"
        >
          <option value="">Все ученики</option>
          {studentOptions.map((student) => (
            <option key={student.id} value={student.id}>
              {student.fullName}
            </option>
          ))}
        </select>

        {studentFilter && (
          <button
            type="button"
            onClick={() => setStudentFilter("")}
            className="btn-secondary py-2 text-xs"
          >
            Сбросить фильтр
          </button>
        )}

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
      </div>

      {view === "day" && (
        <div className="space-y-3">
          <h2 className="overline">
            Занятия на{" "}
            {selected.toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h2>

          {dayLessons.length > 0 ? (
            <div
              className="relative rounded-xl border border-slate-200 bg-white"
              style={{ height: 24 * PIXELS_PER_HOUR }}
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-slate-100 text-[10px] text-slate-300"
                  style={{ top: hour * PIXELS_PER_HOUR }}
                >
                  {hour.toString().padStart(2, "0")}:00
                </div>
              ))}
              {assignOverlapColumns(dayLessons).map(({ session: lesson, column, columnCount }) => {
                // Pinned to Moscow wall-clock so the block's vertical position
                // matches the Moscow-formatted time label printed inside it
                // (formatTimeRange below) — raw Date#getHours()/getMinutes()
                // float on the ambient/server timezone and land the block in
                // the wrong hour row whenever that differs from Moscow.
                const { hour, minute } = moscowWallClock(lesson.scheduledAt);
                const top = ((hour * 60 + minute) / 60) * PIXELS_PER_HOUR;
                const height = Math.max(
                  (lesson.durationMinutes / 60) * PIXELS_PER_HOUR,
                  MIN_SESSION_BLOCK_HEIGHT,
                );
                const widthPct = 100 / columnCount;
                const isCancelled = lesson.status === "cancelled";
                return (
                  <Link
                    key={lesson.id}
                    href={`/lessons/${lesson.id}`}
                    data-testid={`session-block-${lesson.id}`}
                    style={{
                      top,
                      height,
                      left: `calc(${widthPct * column}% + 48px)`,
                      width: `calc(${widthPct}% - 52px)`,
                    }}
                    className={`absolute overflow-hidden rounded-lg border-l-2 px-2 py-1 text-xs shadow-sm transition-colors ${
                      isCancelled
                        ? "border-slate-300 bg-slate-100 text-slate-400"
                        : "border-accent/60 bg-accent/[0.08] text-slate-900 hover:bg-accent/15"
                    }`}
                  >
                    <p className="truncate font-semibold">
                      {getSessionLabel(lesson)}
                      <span className="ml-1 truncate text-[11px] font-normal text-slate-500">
                        {formatTimeRange({
                          scheduledAt: lesson.scheduledAt,
                          durationMinutes: lesson.durationMinutes,
                        })}
                      </span>
                    </p>
                    <span className="badge-info mt-0.5 w-full gap-1 truncate px-1.5 py-0 text-[11px]">
                      <GraduationCap size={12} className="shrink-0" />
                      {getTeacherLabel(lesson, groupTeacherById, teacherNameById)}
                    </span>
                    {lesson.isTrial && (
                      <span className="badge-warning mt-0.5 w-full gap-1 truncate px-1.5 py-0 text-[11px]">
                        <Sparkles size={12} className="shrink-0" />
                        ПРОБНЫЙ УРОК
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty-state bg-white">
              На выбранную дату уроков не запланировано
            </div>
          )}
        </div>
      )}

      {view === "week" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {weekDays.map((day, index) => {
            const key = toDateKey(day);
            const items = lessonsByDay.get(key) ?? [];
            return (
              <div
                key={key}
                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-card"
              >
                <p className="overline">{WEEKDAY_LABELS[index]}</p>
                <p className="mb-2.5 mt-0.5 text-sm font-semibold text-slate-900">
                  {day.toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <div className="space-y-1.5">
                  {items.length === 0 ? (
                    <p className="text-xs text-slate-300">—</p>
                  ) : (
                    items.map((lesson) => {
                      const isCancelled = lesson.status === "cancelled";
                      return (
                        <Link
                          key={lesson.id}
                          href={`/lessons/${lesson.id}`}
                          data-testid={`week-session-${lesson.id}`}
                          className={`block rounded-lg border-l-2 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            isCancelled
                              ? "border-slate-300 bg-slate-100 text-slate-400"
                              : "border-accent/60 bg-accent/[0.06] text-slate-900 hover:bg-accent/15"
                          }`}
                        >
                          <p className="truncate">
                            {formatTimeRange({
                              scheduledAt: lesson.scheduledAt,
                              durationMinutes: lesson.durationMinutes,
                            })}{" "}
                            · {getSessionLabel(lesson)}
                          </p>
                          <span className="badge-info mt-0.5 w-full gap-1 truncate px-1.5 py-0 text-[11px]">
                            <GraduationCap size={12} className="shrink-0" />
                            {getTeacherLabel(lesson, groupTeacherById, teacherNameById)}
                          </span>
                          {lesson.isTrial && (
                            <span className="badge-warning mt-0.5 w-full gap-1 truncate px-1.5 py-0 text-[11px]">
                              <Sparkles size={12} className="shrink-0" />
                              ПРОБНЫЙ
                            </span>
                          )}
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "month" && (
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="overline px-2 py-1 text-center">
              {label}
            </div>
          ))}
          {monthDays.map((day) => {
            const key = toDateKey(day);
            const items = lessonsByDay.get(key) ?? [];
            const isCurrentMonth = day.getMonth() === currentMonth;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedDate(key);
                  setView("day");
                }}
                className={`min-h-[84px] rounded-xl border border-slate-200 bg-white p-2 text-left shadow-card transition-all duration-200 hover:border-accent/25 hover:shadow-card-hover ${
                  isCurrentMonth ? "" : "opacity-40"
                }`}
              >
                <p className="text-xs font-semibold text-slate-900">
                  {day.getDate()}
                </p>
                <div className="mt-1 space-y-1">
                  {items.slice(0, 2).map((lesson) => (
                    <p
                      key={lesson.id}
                      data-testid={`month-chip-${lesson.id}`}
                      className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        lesson.status === "cancelled"
                          ? "bg-slate-100 text-slate-400"
                          : lesson.isTrial
                            ? "bg-amber-100 text-amber-800"
                            : "bg-accent/[0.08] text-slate-900"
                      }`}
                    >
                      {lesson.isTrial && "✦ "}
                      {formatTimeRange({
                        scheduledAt: lesson.scheduledAt,
                        durationMinutes: lesson.durationMinutes,
                      })}{" "}
                      · {getTeacherLabel(lesson, groupTeacherById, teacherNameById)}
                    </p>
                  ))}
                  {items.length > 2 && (
                    <p className="text-[11px] text-slate-500">
                      +{items.length - 2} ещё
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!isTeacher && (
        <Modal
          open={isModalOpen}
          title="Новое занятие"
          onClose={() => setIsModalOpen(false)}
        >
          <LessonWizard
            register={register}
            watch={watch}
            setValue={setValue}
            trigger={trigger}
            errors={errors}
            groups={groups}
            teachers={teachers}
            students={students}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit(onSubmit)}
          />
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
    </div>
  );
}
