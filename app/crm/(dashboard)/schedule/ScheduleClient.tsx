"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Calendar as CalendarIcon,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { LessonWizard } from "@/crm/components/LessonWizard";
import { ConfirmDialog } from "@/crm/components/ConfirmDialog";
import { Modal } from "@/crm/components/Modal";
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
import { createLesson } from "../lessons/actions";

const PIXELS_PER_HOUR = 64;

export interface ScheduleLesson {
  id: string;
  type?: "GROUP" | "INDIVIDUAL";
  scheduledAt: string;
  groupId: string | null;
  studentId?: string | null;
  teacherId: string;
  status: string;
  durationMinutes: number;
  group?: { id: string; name: string } | null;
  student?: { id: string; fullName: string } | null;
}

export interface ScheduleGroup {
  id: string;
  name: string;
  teacherId?: string | null;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  // Set when createLesson reports the chosen time is outside the teacher's
  // declared working hours; drives the override-confirmation dialog so the
  // lesson is never created silently against unavailability.
  const [availabilityWarning, setAvailabilityWarning] = useState<{
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

  // Returns true when the lesson was actually created. `acknowledge` re-submits
  // past the teacher-availability warning after the operator confirmed it.
  const submitCreate = async (
    values: LessonValues,
    acknowledge: boolean,
  ): Promise<boolean> => {
    const result = await createLesson(
      acknowledge ? { ...values, acknowledgeUnavailable: true } : values,
    );
    if (result?.error) {
      showToast(result.error, "error");
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
      await submitCreate(values, false);
    } catch {
      showToast("Не удалось создать занятие", "error");
    }
  };

  const confirmOverride = async () => {
    if (!availabilityWarning) return;
    setOverriding(true);
    try {
      const created = await submitCreate(availabilityWarning.values, true);
      if (created) setAvailabilityWarning(null);
    } catch {
      showToast("Не удалось создать занятие", "error");
    } finally {
      setOverriding(false);
    }
  };

  const filteredLessons = useMemo(
    () =>
      lessons.filter(
        (l) =>
          (!groupFilter || l.groupId === groupFilter) &&
          (!teacherFilter || l.teacherId === teacherFilter) &&
          (showCancelled || l.status !== "cancelled"),
      ),
    [lessons, groupFilter, teacherFilter, showCancelled],
  );

  const lessonsByDay = useMemo(() => {
    const map = new Map<string, ScheduleLesson[]>();
    for (const lesson of filteredLessons) {
      if (!lesson.scheduledAt) continue;
      const key = toDateKey(new Date(lesson.scheduledAt));
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

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
            aria-label="Показать отменённые"
          />
          Показать отменённые
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
                const start = new Date(lesson.scheduledAt);
                const top = ((start.getHours() * 60 + start.getMinutes()) / 60) * PIXELS_PER_HOUR;
                const height = (lesson.durationMinutes / 60) * PIXELS_PER_HOUR;
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
                    <p className="truncate font-semibold">{getSessionLabel(lesson)}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {formatTimeRange({
                        scheduledAt: lesson.scheduledAt,
                        durationMinutes: lesson.durationMinutes,
                      })}
                    </p>
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
                          className={`block rounded-lg border-l-2 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            isCancelled
                              ? "border-slate-300 bg-slate-100 text-slate-400"
                              : "border-accent/60 bg-accent/[0.06] text-slate-900 hover:bg-accent/15"
                          }`}
                        >
                          {formatTimeRange({
                            scheduledAt: lesson.scheduledAt,
                            durationMinutes: lesson.durationMinutes,
                          })}{" "}
                          · {getSessionLabel(lesson)}
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
                      className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        lesson.status === "cancelled"
                          ? "bg-slate-100 text-slate-400"
                          : "bg-accent/[0.08] text-slate-900"
                      }`}
                    >
                      {formatTimeRange({
                        scheduledAt: lesson.scheduledAt,
                        durationMinutes: lesson.durationMinutes,
                      })}
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
        onConfirm={confirmOverride}
        onClose={() => setAvailabilityWarning(null)}
      />
    </div>
  );
}
