"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import type { LessonListFilters } from "@/crm/lib/schemas";

function isNonDefault(filters: LessonListFilters): boolean {
  return (
    filters.q !== "" ||
    Boolean(filters.teacherId) ||
    filters.format !== "ALL" ||
    filters.status !== "ALL" ||
    filters.range !== null ||
    Boolean(filters.from) ||
    Boolean(filters.to)
  );
}

const DATE_PRESETS = [
  ["TODAY", "Сегодня"],
  ["TOMORROW", "Завтра"],
  ["THIS_WEEK", "Эта неделя"],
] as const;

export function LessonsFilterToolbar({
  filters,
  teachers,
  isTeacher,
  onChange,
}: {
  filters: LessonListFilters;
  teachers: { id: string; fullName: string }[];
  isTeacher: boolean;
  onChange: (patch: Record<string, string | null>) => void;
}) {
  const [searchInput, setSearchInput] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch !== filters.q) {
      onChange({ q: debouncedSearch || null });
    }
    // Intentionally excludes onChange/filters.q: this should only fire when
    // the debounced value settles, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Поиск: группа, ученик, преподаватель..."
          className="input min-w-[220px] flex-1"
          aria-label="Поиск занятий"
        />

        {!isTeacher && (
          <Select value={filters.teacherId ?? "ALL"} onValueChange={(v) => onChange({ teacherId: v === "ALL" ? null : v })}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Преподаватель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все преподаватели</SelectItem>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filters.format} onValueChange={(v) => onChange({ format: v })}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Формат" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все форматы</SelectItem>
            <SelectItem value="GROUP">Групповые</SelectItem>
            <SelectItem value="INDIVIDUAL">Индивидуальные</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(v) => onChange({ status: v })}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все статусы</SelectItem>
            <SelectItem value="NEEDS_ATTENTION">Требует внимания</SelectItem>
            <SelectItem value="SCHEDULED">Запланировано</SelectItem>
            <SelectItem value="COMPLETED">Завершено</SelectItem>
            <SelectItem value="CANCELLED">Отменено</SelectItem>
            <SelectItem value="TRIAL">Пробные</SelectItem>
          </SelectContent>
        </Select>

        {isNonDefault(filters) && (
          <button
            type="button"
            onClick={() =>
              onChange({ q: null, teacherId: null, format: null, status: null, range: null, from: null, to: null })
            }
            className="btn-secondary gap-1.5 px-3 py-2 text-xs"
          >
            <X size={14} />
            Сбросить
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESETS.map(([value, label]) => {
          const active = filters.range === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ range: active ? null : value, from: null, to: null })}
              className={active ? "btn-primary px-3 py-1.5 text-xs" : "btn-secondary px-3 py-1.5 text-xs"}
            >
              {label}
            </button>
          );
        })}

        <input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => onChange({ from: e.target.value || null, range: null })}
          className="input w-auto"
          aria-label="Дата с"
        />
        <span className="text-sm text-slate-400">—</span>
        <input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => onChange({ to: e.target.value || null, range: null })}
          className="input w-auto"
          aria-label="Дата по"
        />
      </div>
    </div>
  );
}
