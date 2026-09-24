"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { EXAM_TYPE_LABELS, EXAM_TYPE_VALUES, SUBJECT_VALUES } from "@/shared/lib/education";
import { hasActiveLessonFilters, lessonFiltersToQuery, type LessonFilters } from "@/lms/lib/lesson-filters";
import { pluralRu } from "@/lms/lib/admin-format";

// Radix Select can't hold an empty value, so "all" stands in for "no filter".
const ALL = "__all__";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T | null; label: string }[];
  onChange: (value: T | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-9 items-center rounded-md border border-input bg-black/20 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-full whitespace-nowrap rounded px-2.5 text-xs font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function LessonsToolbar({
  filters,
  courseOptions,
  matched,
}: {
  filters: LessonFilters;
  courseOptions: { id: string; title: string }[];
  matched: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  function apply(patch: Partial<LessonFilters>) {
    const next = { ...filters, ...patch };
    startTransition(() => router.replace(`${pathname}${lessonFiltersToQuery(next)}`, { scroll: false }));
  }

  // Debounced search.
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed === (filters.q ?? "")) return;
    const t = setTimeout(() => apply({ q: trimmed || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // "/" focuses search, like most data tools.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (e.key !== "/" || target?.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = hasActiveLessonFilters(filters);

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-card p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию и описанию…"
            aria-label="Поиск уроков"
            className="h-9 pl-9 pr-9"
          />
          {pending ? (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-[10px] text-muted-foreground sm:block">
              /
            </kbd>
          )}
        </div>

        <Segmented
          label="Экзамен"
          value={filters.exam}
          onChange={(exam) => apply({ exam })}
          options={[{ value: null, label: "Все" }, ...EXAM_TYPE_VALUES.map((v) => ({ value: v, label: EXAM_TYPE_LABELS[v] }))]}
        />

        <Select value={filters.subject ?? ALL} onValueChange={(v) => apply({ subject: v === ALL ? null : (v as LessonFilters["subject"]) })}>
          <SelectTrigger className="h-9 w-44" aria-label="Предмет">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все предметы</SelectItem>
            {SUBJECT_VALUES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.course ?? ALL} onValueChange={(v) => apply({ course: v === ALL ? null : v })}>
          <SelectTrigger className="h-9 w-52" aria-label="Курс">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Все курсы</SelectItem>
            {courseOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Статус"
          value={filters.status}
          onChange={(status) => apply({ status })}
          options={[
            { value: null, label: "Все" },
            { value: "published", label: "Опубликованы" },
            { value: "draft", label: "Черновики" },
            { value: "empty", label: "Без материалов" },
          ]}
        />

        {active ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              Найдено: {matched} {pluralRu(matched, ["урок", "урока", "уроков"])}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                startTransition(() => router.replace(pathname, { scroll: false }));
              }}
            >
              <X />
              Сбросить
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
