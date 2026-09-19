"use client";

import { useState } from "react";
import { DatePicker } from "@/crm/components/DatePicker";
import { DurationChips } from "@/crm/components/DurationChips";
import { TimeSlotPicker } from "@/crm/components/TimeSlotPicker";
import { useToast } from "@/crm/components/ToastProvider";
import { todayKey } from "@/crm/lib/calendarGrid";
import { formatMoscowTime, moscowDateKey } from "@/shared/lib/timezone";
import { updateLesson } from "../actions";

export function LessonScheduleEditor({
  classSessionId,
  scheduledAt,
  durationMinutes,
  locked,
}: {
  classSessionId: string;
  scheduledAt: string;
  durationMinutes: number;
  locked: boolean;
}) {
  const showToast = useToast();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(() => moscowDateKey(scheduledAt));
  const [time, setTime] = useState(() => formatMoscowTime(scheduledAt));
  const [duration, setDuration] = useState(durationMinutes);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const result = await updateLesson(classSessionId, { date, time, durationMinutes: duration });
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Занятие перенесено");
        setEditing(false);
      }
    } catch {
      showToast("Не удалось перенести занятие", "error");
    } finally {
      setSaving(false);
    }
  };

  if (locked) {
    return (
      <p className="text-xs text-slate-400">
        Дату и время нельзя изменить после отметки посещаемости.
      </p>
    );
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="btn-secondary py-1 text-xs">
        Изменить дату и время
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3.5 py-2.5">
      <DatePicker value={date} onChange={setDate} min={todayKey()} disabled={saving} />
      <TimeSlotPicker value={time} onChange={setTime} disabled={saving} />
      <DurationChips value={duration} onChange={setDuration} disabled={saving} />
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className="btn-secondary py-1 text-xs">
          Сохранить
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="btn-secondary py-1 text-xs"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
