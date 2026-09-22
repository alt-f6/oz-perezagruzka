"use client";

import { useState } from "react";
import { useToast } from "@/crm/components/ToastProvider";
import { CRM_TIMEZONES } from "@/shared/lib/timezone";
import { updateTimezone } from "./actions";

export function ProfileClient({ initialTimezone }: { initialTimezone: string }) {
  const showToast = useToast();
  const [timezone, setTimezone] = useState(initialTimezone);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const result = await updateTimezone(timezone);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast("Часовой пояс сохранён");
      }
    } catch {
      showToast("Не удалось сохранить часовой пояс", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="page-title">Профиль</h1>
        <p className="page-subtitle">Настройки отображения времени</p>
      </div>
      <div>
        <label htmlFor="profile-timezone" className="label">
          Часовой пояс
        </label>
        <select
          id="profile-timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          disabled={saving}
          className="input"
        >
          {CRM_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.cityLabel} ({tz.utcOffsetLabel})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          Влияет на отображение расписания и ввод времени занятий.
        </p>
      </div>
      <button type="button" onClick={save} disabled={saving} className="btn-primary">
        {saving ? "Сохранение..." : "Сохранить"}
      </button>
    </div>
  );
}
