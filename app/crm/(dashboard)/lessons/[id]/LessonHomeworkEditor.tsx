"use client";

import { useState } from "react";
import { useToast } from "@/crm/components/ToastProvider";
import { updateLessonHomework } from "../actions";

export function LessonHomeworkEditor({
  lessonId,
  homework,
}: {
  lessonId: string;
  homework: string | null;
}) {
  const showToast = useToast();
  const [value, setValue] = useState(homework ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const result = await updateLessonHomework(lessonId, value);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Домашнее задание сохранено");
      }
    } catch {
      showToast("Не удалось сохранить домашнее задание", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="label" htmlFor="lesson-homework">
        Домашнее задание
      </label>
      <textarea
        id="lesson-homework"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Номера заданий, формулировка темы или ссылка на материалы..."
        rows={3}
        className="input w-full resize-y"
      />
      <button type="button" onClick={save} disabled={saving} className="btn-secondary py-1 text-xs">
        Сохранить
      </button>
    </div>
  );
}
