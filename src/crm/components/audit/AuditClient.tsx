"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatMoscowDateTime } from "@/shared/lib/timezone";

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityTitle: string | null;
  details: unknown;
  createdAt: string;
}

export interface AuditFilters {
  userId?: string;
  entityType?: string;
  q: string;
  page: number;
  pageSize: number;
}

interface AuditClientProps {
  initialLogs: AuditLogEntry[];
  initialTotal: number;
  initialFilters: AuditFilters;
  staff: { id: string; fullName: string }[];
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Администратор",
  MANAGER: "Куратор",
  TEACHER: "Преподаватель",
  SYSTEM: "Система",
};

const ACTION_META: Record<string, { label: string; classes: string }> = {
  CREATE: { label: "Создание", classes: "bg-emerald-50 text-emerald-700" },
  UPDATE: { label: "Изменение", classes: "bg-blue-50 text-blue-700" },
  RESCHEDULE: { label: "Перенос", classes: "bg-orange-50 text-orange-700" },
  DELETE: { label: "Удаление", classes: "bg-rose-50 text-rose-700" },
  CANCEL: { label: "Отмена", classes: "bg-rose-50 text-rose-700" },
  ADJUST_BALANCE: { label: "Корректировка", classes: "bg-violet-50 text-violet-700" },
  INVITE_CREATED: { label: "Приглашение", classes: "bg-blue-50 text-blue-700" },
};

const ENTITY_LABELS: Record<string, string> = {
  STUDENT: "Студент",
  GROUP: "Группа",
  LESSON: "Занятие",
  TRANSACTION: "Транзакция",
  TEACHER: "Преподаватель",
  INVITE: "Приглашение",
};

const ENTITY_TYPE_OPTIONS = ["STUDENT", "GROUP", "LESSON", "TRANSACTION", "TEACHER", "INVITE"];

// Every value that ever reaches here came off a Json column (already
// JSON-safe by construction), so JSON.stringify cannot fail on it in
// practice -- the try/catch is a hard guarantee the accordion never throws
// regardless of what shape a future caller passes as `details`.
function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_META[action] ?? { label: action, classes: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.classes}`}>
      {meta.label}
    </span>
  );
}

function DetailsAccordion({ details }: { details: unknown }) {
  const [open, setOpen] = useState(false);
  const hasDetails = details !== null && details !== undefined;

  if (!hasDetails) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Скрыть" : "Показать"}
      </button>
      {open && (
        <pre className="mt-2 max-w-md overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-700">
          {safeStringify(details)}
        </pre>
      )}
    </div>
  );
}

export function AuditClient({ initialLogs, initialTotal, initialFilters, staff }: AuditClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(initialFilters.q);

  const logs = initialLogs;
  const total = initialTotal;
  const filters = initialFilters;

  const updateQuery = (patch: Record<string, string | null>) => {
    const current = Object.fromEntries(searchParams.entries());
    const next = { ...current };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") {
        delete next[key];
      } else {
        next[key] = value;
      }
    }
    if (!("page" in patch)) {
      next.page = "1";
    }
    const qs = new URLSearchParams(next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateQuery({ q: searchInput });
  };

  const goToPage = (page: number) => updateQuery({ page: String(page) });

  const pageStart = total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const pageEnd = Math.min(filters.page * filters.pageSize, total);
  const hasPrevPage = filters.page > 1;
  const hasNextPage = filters.page * filters.pageSize < total;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px]">
          <label className="label">Сотрудник</label>
          <select
            value={filters.userId ?? ""}
            onChange={(e) => updateQuery({ userId: e.target.value || null })}
            className="input py-2"
          >
            <option value="">Все сотрудники</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[180px]">
          <label className="label">Тип объекта</label>
          <select
            value={filters.entityType ?? ""}
            onChange={(e) => updateQuery({ entityType: e.target.value || null })}
            className="input py-2"
          >
            <option value="">Все типы</option>
            {ENTITY_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {ENTITY_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="min-w-[220px] flex-1">
          <label className="label">Поиск</label>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Имя объекта или сотрудника"
            className="input py-2"
          />
        </form>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Дата и время</th>
              <th className="px-3 py-2 text-left">Сотрудник</th>
              <th className="px-3 py-2 text-left">Действие</th>
              <th className="px-3 py-2 text-left">Объект</th>
              <th className="px-3 py-2 text-left">Детали</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-500">
                  Записи не найдены.
                </td>
              </tr>
            ) : (
              logs.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {formatMoscowDateTime(entry.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{entry.userName}</div>
                    <span className="text-xs text-slate-500">
                      {ROLE_LABELS[entry.userRole] ?? entry.userRole}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    <span className="text-xs text-slate-400">
                      {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
                    </span>
                    {entry.entityTitle ? <div>{entry.entityTitle}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    <DetailsAccordion details={entry.details} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <p>
            Показано {pageStart}–{pageEnd} из {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(filters.page - 1)}
              disabled={!hasPrevPage}
              className="icon-btn disabled:opacity-40"
              aria-label="Предыдущая страница"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => goToPage(filters.page + 1)}
              disabled={!hasNextPage}
              className="icon-btn disabled:opacity-40"
              aria-label="Следующая страница"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
