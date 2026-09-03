"use client";

import { ChevronLeft, ChevronRight, Copy, Lock, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/crm/components/ToastProvider";
import { ConfirmDialog } from "@/crm/components/ConfirmDialog";
import {
  EMPTY_WEEK_SLOTS,
  WEEKDAY_LABELS_MON0,
  addWeeks,
  availabilityHours,
  countActiveSlots,
  isSlotOn,
  moscowWeekStartKey,
  setDaySlots,
  slotRangeLabel,
  weekKeyToDate,
  withSlot,
} from "@/crm/lib/availability";
import {
  copyTeacherAvailabilityWeek,
  getTeacherAvailability,
  saveTeacherAvailability,
  type BookedConflictInfo,
} from "./availability-actions";

export interface AvailabilityTeacher {
  id: string;
  fullName: string;
}

const HOURS = availabilityHours();

/** Formats a Monday week key as a "Пн, 13 окт – Вс, 19 окт" range (UTC-safe). */
function weekRangeLabel(weekStart: string): string {
  const monday = weekKeyToDate(weekStart);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const fmt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
  return `${fmt.format(monday)} – ${fmt.format(sunday)}`;
}

export function AvailabilityGrid({
  teachers,
  initialTeacherId,
  canChooseTeacher,
}: {
  teachers: AvailabilityTeacher[];
  initialTeacherId: string;
  canChooseTeacher: boolean;
}) {
  const showToast = useToast();
  const currentWeek = useMemo(() => moscowWeekStartKey(new Date()), []);

  const [teacherId, setTeacherId] = useState(initialTeacherId);
  const [weekStart, setWeekStart] = useState(currentWeek);
  const [slots, setSlots] = useState(EMPTY_WEEK_SLOTS);
  const [savedSlots, setSavedSlots] = useState(EMPTY_WEEK_SLOTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<
    BookedConflictInfo[] | null
  >(null);

  const isPast = weekStart < currentWeek;
  const readOnly = isPast || !teacherId;
  const dirty = slots !== savedSlots;

  // Drag-to-paint: pointerdown decides the target value, pointerenter applies it
  // to any cell the pointer sweeps while held. Cleared on pointerup anywhere.
  const paintValue = useRef<boolean | null>(null);

  const load = useCallback(async () => {
    if (!teacherId) return;
    setLoading(true);
    try {
      const res = await getTeacherAvailability(teacherId, [weekStart]);
      if ("error" in res && res.error) {
        showToast(res.error, "error");
        return;
      }
      const week = "weeks" in res ? res.weeks[0] : undefined;
      const next = week?.slots ?? EMPTY_WEEK_SLOTS;
      setSlots(next);
      setSavedSlots(next);
    } catch {
      showToast("Не удалось загрузить доступность", "error");
    } finally {
      setLoading(false);
    }
  }, [teacherId, weekStart, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const stop = () => {
      paintValue.current = null;
    };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const applyCell = (dayIndex: number, hour: number, on: boolean) => {
    setSlots((prev) => withSlot(prev, dayIndex, hour, on));
  };

  const onCellPointerDown = (dayIndex: number, hour: number) => {
    if (readOnly) return;
    const target = !isSlotOn(slots, dayIndex, hour);
    paintValue.current = target;
    applyCell(dayIndex, hour, target);
  };

  const onCellPointerEnter = (dayIndex: number, hour: number) => {
    if (readOnly || paintValue.current === null) return;
    applyCell(dayIndex, hour, paintValue.current);
  };

  const toggleDay = (dayIndex: number, on: boolean) => {
    if (readOnly) return;
    setSlots((prev) => setDaySlots(prev, dayIndex, on));
  };

  const clearWeek = () => {
    if (readOnly) return;
    setSlots(EMPTY_WEEK_SLOTS);
  };

  const persist = async (acknowledgeBookedConflicts: boolean) => {
    if (!teacherId) return;
    setSaving(true);
    try {
      const res = await saveTeacherAvailability({
        teacherId,
        weekStart,
        slots,
        acknowledgeBookedConflicts,
      });
      if ("error" in res && res.error) {
        showToast(res.error, "error");
        return;
      }
      if ("needsConfirmation" in res && res.needsConfirmation) {
        setPendingConflicts(res.conflicts);
        return;
      }
      setSavedSlots(slots);
      setPendingConflicts(null);
      showToast("Доступность сохранена");
    } catch {
      showToast("Не удалось сохранить доступность", "error");
    } finally {
      setSaving(false);
    }
  };

  const copyToNextWeek = async () => {
    if (!teacherId) return;
    setSaving(true);
    try {
      const target = addWeeks(weekStart, 1);
      const res = await copyTeacherAvailabilityWeek({
        teacherId,
        fromWeekStart: weekStart,
        toWeekStart: target,
      });
      if ("error" in res && res.error) {
        showToast(res.error, "error");
        return;
      }
      if ("needsConfirmation" in res && res.needsConfirmation) {
        showToast(
          "На следующей неделе есть занятия вне копируемой сетки — откройте её, чтобы подтвердить",
          "error",
        );
        return;
      }
      showToast("Скопировано на следующую неделю");
    } catch {
      showToast("Не удалось скопировать неделю", "error");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = countActiveSlots(slots);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {canChooseTeacher && (
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="input w-auto py-2 shadow-sm"
            aria-label="Преподаватель"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
            className="icon-btn h-8 w-8"
            aria-label="Предыдущая неделя"
          >
            <ChevronLeft size={17} />
          </button>
          <span className="px-2.5 text-sm font-semibold text-slate-900">
            {weekRangeLabel(weekStart)}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="icon-btn h-8 w-8"
            aria-label="Следующая неделя"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        {weekStart !== currentWeek && (
          <button
            type="button"
            onClick={() => setWeekStart(currentWeek)}
            className="btn-secondary py-2"
          >
            Текущая неделя
          </button>
        )}

        {isPast && (
          <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-500">
            <Lock size={13} /> Прошедшая неделя — только просмотр
          </span>
        )}
      </div>

      <p className="text-sm text-slate-500">
        Отметьте рабочие часы (07:00–22:00 МСК). Отмечено слотов: {activeCount} из 105.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] select-none border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="w-16 border-b border-slate-100 p-2 text-slate-400">
                Время
              </th>
              {WEEKDAY_LABELS_MON0.map((label, dayIndex) => (
                <th
                  key={label}
                  className="border-b border-l border-slate-100 p-2 font-semibold text-slate-700"
                >
                  <div>{label}</div>
                  {!readOnly && (
                    <div className="mt-1 flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleDay(dayIndex, true)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/10"
                        title="Отметить весь день"
                      >
                        Всё
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDay(dayIndex, false)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-100"
                        title="Очистить день"
                      >
                        Сброс
                      </button>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((hour) => (
              <tr key={hour}>
                <td className="border-t border-slate-100 p-1.5 text-[11px] text-slate-500">
                  {slotRangeLabel(hour)}
                </td>
                {WEEKDAY_LABELS_MON0.map((_, dayIndex) => {
                  const on = isSlotOn(slots, dayIndex, hour);
                  return (
                    <td
                      key={dayIndex}
                      className="border-l border-t border-slate-100 p-0"
                    >
                      <button
                        type="button"
                        disabled={readOnly}
                        aria-pressed={on}
                        aria-label={`${WEEKDAY_LABELS_MON0[dayIndex]} ${slotRangeLabel(hour)}`}
                        onPointerDown={() => onCellPointerDown(dayIndex, hour)}
                        onPointerEnter={() => onCellPointerEnter(dayIndex, hour)}
                        className={`h-9 w-full touch-none transition-colors ${
                          on
                            ? "bg-accent/80 hover:bg-accent"
                            : "bg-white hover:bg-slate-100"
                        } ${readOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => persist(false)}
            disabled={saving || loading || !dirty}
            className="btn-primary"
          >
            <Save size={16} />
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={clearWeek}
            disabled={saving || loading}
            className="btn-secondary"
          >
            Очистить неделю
          </button>
          <button
            type="button"
            onClick={copyToNextWeek}
            disabled={saving || loading || dirty}
            title={dirty ? "Сначала сохраните изменения" : undefined}
            className="btn-secondary"
          >
            <Copy size={16} />
            Скопировать на следующую неделю
          </button>
          {dirty && (
            <span className="text-xs font-medium text-amber-600">
              Есть несохранённые изменения
            </span>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingConflicts !== null}
        danger
        title="В этих слотах уже есть занятия"
        confirmLabel="Всё равно сохранить"
        busy={saving}
        message={
          <span>
            Вы снимаете рабочие часы, на которые уже запланированы занятия:
            <br />
            {(pendingConflicts ?? []).map((c) => (
              <span key={c.scheduledAt} className="mt-1 block font-medium text-slate-800">
                • {c.label}
              </span>
            ))}
            Занятия не будут отменены автоматически.
          </span>
        }
        onConfirm={() => persist(true)}
        onClose={() => setPendingConflicts(null)}
      />
    </div>
  );
}
