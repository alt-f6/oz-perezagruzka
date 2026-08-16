"use client";

import { useState } from "react";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/crm/components/ToastProvider";
import { createFreeze, deleteFreeze } from "./freeze-actions";

export interface FreezeRow {
  id: string;
  startDate: string;
  endDate: string;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { timeZone: "UTC" });
}

export function FreezeSection({
  studentId,
  freezes,
  canManage,
}: {
  studentId: string;
  freezes: FreezeRow[];
  canManage: boolean;
}) {
  const showToast = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!startDate || !endDate) {
      showToast("Укажите период заморозки", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await createFreeze(studentId, { startDate, endDate });
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      showToast("Заморозка добавлена");
      setStartDate("");
      setEndDate("");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (freezeId: string) => {
    setBusy(true);
    try {
      const result = await deleteFreeze(freezeId);
      if (result.error) {
        showToast(result.error, "error");
        return;
      }
      showToast("Заморозка снята");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-4">
      <h2 className="section-title flex items-center gap-2 text-lg">
        <CalendarOff size={20} className="text-slate-600" />
        Заморозки абонемента
      </h2>
      <p className="text-xs text-slate-600">
        В период активной заморозки списания за занятия не создаются.
      </p>

      {freezes.length > 0 ? (
        <ul className="space-y-2">
          {freezes.map((freeze) => (
            <li
              key={freeze.id}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-900"
            >
              <span>
                {formatDay(freeze.startDate)} — {formatDay(freeze.endDate)}
              </span>
              {canManage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(freeze.id)}
                  className="text-slate-500 transition hover:text-red-600 disabled:opacity-50"
                  title="Снять заморозку"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Заморозок нет.</p>
      )}

      {canManage && (
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4">
          <div>
            <label className="label">
              Начало
            </label>
            <input
              type="date"
              value={startDate}
              disabled={busy}
              onChange={(e) => setStartDate(e.target.value)}
              className="input w-60"
            />
          </div>
          <div>
            <label className="label">
              Окончание
            </label>
            <input
              type="date"
              value={endDate}
              disabled={busy}
              onChange={(e) => setEndDate(e.target.value)}
              className="input w-60"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleCreate}
            className="btn-primary px-3.5 py-2"
          >
            <Plus size={15} />
            Добавить заморозку
          </button>
        </div>
      )}
    </div>
  );
}
