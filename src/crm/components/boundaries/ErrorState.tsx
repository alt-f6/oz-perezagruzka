"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export function ErrorState({
  title = "Что-то пошло не так",
  description = "Не удалось загрузить данные. Попробуйте ещё раз через несколько секунд.",
  digest,
  onRetry,
}: {
  title?: string;
  description?: string;
  digest?: string;
  onRetry: () => void;
}) {
  return (
    <div className="empty-state border-rose-200 bg-rose-50/40 py-16">
      <div className="icon-tile bg-rose-100 text-cancel">
        <AlertTriangle size={22} />
      </div>
      <h2 className="section-title mt-2">{title}</h2>
      <p className="max-w-md text-sm text-slate-500">{description}</p>
      {digest && <p className="font-mono text-xs text-slate-400">Код ошибки: {digest}</p>}
      <button type="button" onClick={onRetry} className="btn-secondary mt-2">
        <RotateCcw size={16} />
        Попробовать снова
      </button>
    </div>
  );
}
