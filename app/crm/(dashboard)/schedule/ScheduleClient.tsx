"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "@/crm/components/Modal";
import { useToast } from "@/crm/components/ToastProvider";
import { lessonSchema, type LessonValues } from "@/crm/lib/schemas";
import { createLesson } from "../lessons/actions";

export interface ScheduleLesson {
  id: string;
  scheduledAt: string;
  groupId: string;
  teacherId: string;
  group?: { id: string; name: string } | null;
}

export interface ScheduleGroup {
  id: string;
  name: string;
}

export interface ScheduleTeacher {
  id: string;
  fullName: string;
}

type ViewMode = "day" | "week" | "month";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getGroupName(lesson: ScheduleLesson): string {
  return lesson.group?.name ?? "Без группы";
}

export function ScheduleClient({
  lessons,
  groups,
  teachers,
}: {
  lessons: ScheduleLesson[];
  groups: ScheduleGroup[];
  teachers: ScheduleTeacher[];
}) {
  const showToast = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [view, setView] = useState<ViewMode>("day");
  const [groupFilter, setGroupFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LessonValues>({ resolver: zodResolver(lessonSchema) });

  const onSubmit = async (values: LessonValues) => {
    try {
      const result = await createLesson(values);
      if (result?.error) {
        showToast(result.error, "error");
        return;
      }
      showToast("Занятие создано");
      reset();
      setIsModalOpen(false);
    } catch {
      showToast("Не удалось создать занятие", "error");
    }
  };

  const filteredLessons = useMemo(
    () =>
      lessons.filter(
        (l) =>
          (!groupFilter || l.groupId === groupFilter) &&
          (!teacherFilter || l.teacherId === teacherFilter),
      ),
    [lessons, groupFilter, teacherFilter],
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
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(toDateKey(d));
  };

  const navigate = (direction: 1 | -1) => {
    if (view === "day") changeDate(direction);
    else if (view === "week") changeDate(direction * 7);
    else {
      const d = new Date(selectedDate);
      d.setMonth(d.getMonth() + direction);
      setSelectedDate(toDateKey(d));
    }
  };

  const selected = new Date(selectedDate);
  const dayLessons = lessonsByDay.get(selectedDate) ?? [];
  const weekStart = startOfWeek(selected);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthGridStart = startOfWeek(startOfMonth(selected));
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

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <Plus size={16} />
          Новое занятие
        </button>
      </div>

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
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {dayLessons.map((lesson) => {
                const isPast = new Date(lesson.scheduledAt) < new Date();
                return (
                  <div
                    key={lesson.id}
                    className="card card-hover flex flex-col justify-between p-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={
                            isPast ? "badge-success" : "badge-neutral"
                          }
                        >
                          {isPast ? "Проведен" : "Запланирован"}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-slate-600">
                          {new Date(lesson.scheduledAt).toLocaleTimeString(
                            "ru-RU",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold tracking-tight text-slate-900">
                        {getGroupName(lesson)}
                      </h3>
                    </div>
                    <div className="divider mt-4 flex justify-end pt-3">
                      <Link
                        href={`/lessons/${lesson.id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900"
                      >
                        Перейти к уроку →
                      </Link>
                    </div>
                  </div>
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
                    items.map((lesson) => (
                      <Link
                        key={lesson.id}
                        href={`/lessons/${lesson.id}`}
                        className="block rounded-lg border-l-2 border-accent/60 bg-accent/[0.06] px-2.5 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-accent/15"
                      >
                        {new Date(lesson.scheduledAt).toLocaleTimeString(
                          "ru-RU",
                          { hour: "2-digit", minute: "2-digit" },
                        )}{" "}
                        · {getGroupName(lesson)}
                      </Link>
                    ))
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
                      className="truncate rounded bg-accent/[0.08] px-1.5 py-0.5 text-[11px] font-medium text-slate-900"
                    >
                      {getGroupName(lesson)}
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

      <Modal
        open={isModalOpen}
        title="Новое занятие"
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">
              Группа
            </label>
            <select
              disabled={isSubmitting}
              {...register("groupId")}
              className="input"
            >
              <option value="">Выберите группу...</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            {errors.groupId && (
              <p className="field-error">
                {errors.groupId.message}
              </p>
            )}
          </div>
          <div>
            <label className="label">
              Дата и время
            </label>
            <input
              type="datetime-local"
              disabled={isSubmitting}
              {...register("date")}
              className="input"
            />
            {errors.date && (
              <p className="field-error">{errors.date.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full"
          >
            {isSubmitting ? "Создание..." : "Создать"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
