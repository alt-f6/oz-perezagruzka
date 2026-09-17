"use client";

import { useState } from "react";
import { useToast } from "@/crm/components/ToastProvider";
import { updateLesson } from "../actions";

export function LessonPricingEditor({
  classSessionId,
  type,
  pricePerLesson,
  isFree,
  locked,
}: {
  classSessionId: string;
  type: "GROUP" | "INDIVIDUAL";
  pricePerLesson: number | null;
  isFree: boolean;
  locked: boolean;
}) {
  const showToast = useToast();
  const [price, setPrice] = useState(pricePerLesson ?? 0);
  const [free, setFree] = useState(isFree);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const result = await updateLesson(classSessionId, {
        ...(type === "INDIVIDUAL" ? { pricePerLesson: price } : {}),
        isFree: free,
      });
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Занятие обновлено");
      }
    } catch {
      showToast("Не удалось обновить занятие", "error");
    } finally {
      setSaving(false);
    }
  };

  if (locked) {
    return (
      <p className="text-xs text-slate-400">
        Стоимость занятия зафиксирована после отметки посещаемости.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3.5 py-2.5">
      {type === "INDIVIDUAL" && (
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          Цена, ₽
          <input
            type="number"
            min={0}
            step={1}
            value={price}
            disabled={saving}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="input w-24 py-1"
          />
        </label>
      )}
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={free}
          disabled={saving}
          onChange={(e) => setFree(e.target.checked)}
        />
        Бесплатное занятие
      </label>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="btn-secondary py-1 text-xs"
      >
        Сохранить
      </button>
    </div>
  );
}
