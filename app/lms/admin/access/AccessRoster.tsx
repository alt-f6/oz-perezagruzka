"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Infinity as InfinityIcon, Loader2, Minus, Pause, Play, Plus, Search, Trash2, UserPlus, Users, X } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { describeAccess } from "@/lms/lib/enrollment-access";
import { pluralRu } from "@/lms/lib/admin-format";
import type { CourseRoster, GroupOption, RosterEntry, StudentOption } from "@/lms/server/admin/access";
import { EmptyState, ExamPill, Panel, TagPill } from "@/lms/components/admin/primitives";

import { AddGroupSheet, AddStudentsSheet } from "./AccessSheets";

type StatusFilter = "ACTIVE" | "SUSPENDED" | "ALL";

const STATUS_LABEL: Record<RosterEntry["status"], string> = {
  ACTIVE: "Активен",
  SUSPENDED: "Приостановлен",
  COMPLETED: "Завершил",
};

async function patchEnrollment(id: string, body: Record<string, unknown>) {
  const r = await fetch(`/api/admin/enrollments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  return Boolean(r.ok && j?.ok);
}

/** Pips for each module (filled = paid), with -/+ month and "весь курс". */
function AccessControl({
  entry,
  modules,
  onChange,
  busy,
}: {
  entry: RosterEntry;
  modules: CourseRoster["modules"];
  onChange: (next: number | null) => void;
  busy: boolean;
}) {
  const total = modules.length;
  const cursor = entry.accessThroughModule;
  const open = cursor === null ? total : Math.min(cursor, total);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5" aria-label={describeAccess(cursor, total)} role="img">
        {total <= 12 ? (
          modules.map((m, i) => (
            <span
              key={m.id}
              title={`${i + 1}. ${m.title}${i < open ? " — открыт" : " — закрыт"}`}
              className={cn("h-4 w-2.5 rounded-sm", i < open ? "bg-primary" : "border border-border-strong bg-transparent")}
            />
          ))
        ) : (
          <span className="text-xs tabular-nums text-foreground">
            {open}/{total}
          </span>
        )}
      </div>
      <span className="hidden w-24 truncate text-xs text-muted-foreground xl:inline">{describeAccess(cursor, total)}</span>
      <div className="flex items-center">
        <button
          type="button"
          aria-label="Закрыть последний месяц"
          title="Закрыть последний месяц"
          disabled={busy || total === 0 || open === 0}
          onClick={() => onChange(Math.max(0, open - 1))}
          className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Открыть следующий месяц"
          title="Открыть следующий месяц"
          disabled={busy || cursor === null || open >= total}
          onClick={() => onChange(Math.min(total, open + 1))}
          className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={cursor === null ? "Перевести на абонемент" : "Открыть весь курс"}
          title={cursor === null ? "Перевести на абонемент (закрепить открытые модули)" : "Открыть весь курс"}
          disabled={busy}
          onClick={() => onChange(cursor === null ? total : null)}
          className={cn(
            "flex size-7 items-center justify-center rounded hover:bg-accent disabled:opacity-30",
            cursor === null ? "text-primary-2" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <InfinityIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function RosterRow({
  entry,
  modules,
  selected,
  onSelect,
}: {
  entry: RosterEntry;
  modules: CourseRoster["modules"];
  selected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState(entry);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [, startTransition] = useTransition();

  async function update(body: Record<string, unknown>, optimistic: Partial<RosterEntry>) {
    const prev = state;
    setState({ ...state, ...optimistic });
    setBusy(true);
    setError(false);
    const ok = await patchEnrollment(entry.id, body);
    setBusy(false);
    if (!ok) {
      setState(prev);
      setError(true);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function remove() {
    setBusy(true);
    const r = await fetch(`/api/admin/enrollments/${entry.id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) {
      setError(true);
      setConfirmRemove(false);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <tr className={cn("border-t border-border transition-colors", selected ? "bg-primary/10" : "hover:bg-accent/40")}>
      <td className="w-10 px-3 py-2">
        <input
          type="checkbox"
          aria-label={`Выбрать ${state.student.fullName}`}
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="size-4 accent-primary"
        />
      </td>
      <td className="min-w-48 px-3 py-2">
        <p className="truncate text-sm font-medium text-foreground">{state.student.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{state.student.email ?? "без email"}</p>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            Не удалось сохранить
          </p>
        ) : null}
      </td>
      <td className="hidden px-3 py-2 md:table-cell">
        {state.sourceGroupName ? (
          <TagPill tone="sky">
            <Users className="size-3" /> {state.sourceGroupName}
          </TagPill>
        ) : (
          <span className="text-xs text-muted-foreground">Вручную</span>
        )}
      </td>
      <td className="px-3 py-2">
        <AccessControl
          entry={state}
          modules={modules}
          busy={busy}
          onChange={(next) => update({ access_through_module: next }, { accessThroughModule: next })}
        />
      </td>
      <td className="px-3 py-2">
        <Select
          value={state.status}
          onValueChange={(status) => update({ status }, { status: status as RosterEntry["status"] })}
          disabled={busy}
        >
          <SelectTrigger
            className={cn("h-8 w-36", state.status !== "ACTIVE" && "text-muted-foreground")}
            aria-label="Статус записи"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABEL) as RosterEntry["status"][]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="hidden px-3 py-2 text-xs text-muted-foreground tabular-nums lg:table-cell">
        {new Date(state.enrolledAt).toLocaleDateString("ru-RU")}
      </td>
      <td className="w-28 px-3 py-2 text-right">
        {confirmRemove ? (
          <span className="inline-flex items-center gap-1">
            <Button type="button" size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={remove} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Удалить
            </Button>
            <button
              type="button"
              aria-label="Отмена"
              onClick={() => setConfirmRemove(false)}
              className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Отписать ${state.student.fullName} от курса`}
            title="Отписать от курса"
            onClick={() => setConfirmRemove(true)}
            className="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

export function AccessRoster({
  roster,
  groups,
  students,
}: {
  roster: CourseRoster;
  groups: GroupOption[];
  students: StudentOption[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<"students" | "group" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [, startTransition] = useTransition();

  const moduleCount = roster.modules.length;
  const activeStudentIds = useMemo(
    () => new Set(roster.enrollments.filter((e) => e.status === "ACTIVE").map((e) => e.student.id)),
    [roster.enrollments],
  );

  const counts = useMemo(
    () => ({
      ACTIVE: roster.enrollments.filter((e) => e.status === "ACTIVE").length,
      SUSPENDED: roster.enrollments.filter((e) => e.status !== "ACTIVE").length,
      ALL: roster.enrollments.length,
    }),
    [roster.enrollments],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return roster.enrollments.filter(
      (e) =>
        (status === "ALL" || (status === "ACTIVE" ? e.status === "ACTIVE" : e.status !== "ACTIVE")) &&
        (!needle || e.student.fullName.toLowerCase().includes(needle) || e.student.email?.toLowerCase().includes(needle)),
    );
  }, [roster.enrollments, q, status]);

  const allVisibleSelected = visible.length > 0 && visible.every((e) => selected.has(e.id));

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function bulk(action: "advance" | "full" | "suspend" | "activate" | "remove") {
    setBulkBusy(action);
    setConfirmBulkRemove(false);
    const r = await fetch(`/api/admin/courses/${roster.course.id}/enrollments/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids: [...selected] }),
    });
    const j = await r.json().catch(() => null);
    setBulkBusy(null);
    if (!r.ok || !j?.ok) {
      setNotice("Не удалось выполнить действие");
      return;
    }
    setNotice(`Обновлено записей: ${j.updated}`);
    setSelected(new Set());
    startTransition(() => router.refresh());
  }

  const unpublished = roster.modules.filter((m) => !m.isPublished).length;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-foreground">{roster.course.title}</h2>
            <ExamPill examType={roster.course.examType} />
            {roster.course.subject ? <TagPill tone="sky">{roster.course.subject}</TagPill> : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {moduleCount} {pluralRu(moduleCount, ["модуль", "модуля", "модулей"])}
            {unpublished > 0 ? ` · ${unpublished} скрыто` : ""} ·{" "}
            <Link href={`/admin/lessons?course=${roster.course.id}`} className="hover:text-foreground hover:underline">
              уроки курса
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setSheet("group")}>
            <Users />
            Группа из CRM
          </Button>
          <Button type="button" size="sm" onClick={() => setSheet("students")}>
            <UserPlus />
            Записать учеников
          </Button>
        </div>
      </Panel>

      {moduleCount === 0 ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          В курсе нет модулей — абонемент по месяцам недоступен, пока не появятся модули.
        </p>
      ) : null}

      {notice ? (
        <div role="status" className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <span>{notice}</span>
          <button type="button" aria-label="Скрыть" onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск ученика…" className="h-9 pl-9" aria-label="Поиск по записанным" />
        </div>
        <div role="radiogroup" aria-label="Статус" className="flex h-9 items-center rounded-md border border-input bg-black/20 p-0.5">
          {(
            [
              ["ACTIVE", "Активные"],
              ["SUSPENDED", "Приостановленные"],
              ["ALL", "Все"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={status === key}
              onClick={() => setStatus(key)}
              className={cn(
                "h-full whitespace-nowrap rounded px-2.5 text-xs font-medium transition-colors",
                status === key ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label} <span className="tabular-nums text-muted-foreground">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {roster.enrollments.length === 0 ? (
        <EmptyState
          title="На курс пока никто не записан"
          description="Запишите учеников по одному или сразу всю группу из CRM. Открытые уроки появятся у них в личном кабинете."
        />
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Никого не найдено.</p>
      ) : (
        <div className={cn("overflow-x-auto rounded-lg border border-border bg-card", selected.size > 0 && "mb-20")}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Выбрать всех на странице"
                    checked={allVisibleSelected}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const v of visible) {
                          if (e.target.checked) next.add(v.id);
                          else next.delete(v.id);
                        }
                        return next;
                      })
                    }
                    className="size-4 accent-primary"
                  />
                </th>
                <th className="px-3 py-2">Ученик</th>
                <th className="hidden px-3 py-2 md:table-cell">Источник</th>
                <th className="px-3 py-2">Модули</th>
                <th className="px-3 py-2">Статус</th>
                <th className="hidden px-3 py-2 lg:table-cell">Записан</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <RosterRow
                  key={`${e.id}:${e.status}:${e.accessThroughModule}`}
                  entry={e}
                  modules={roster.modules}
                  selected={selected.has(e.id)}
                  onSelect={(c) => toggle(e.id, c)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Действия с выбранными учениками"
          className="fixed inset-x-0 bottom-0 z-40 px-4 lg:left-60"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-lg border border-border-strong bg-popover px-3 py-2 shadow-2xl shadow-black/60">
            <span className="mr-1 text-sm font-medium tabular-nums">Выбрано: {selected.size}</span>
            <Button type="button" size="sm" onClick={() => bulk("advance")} disabled={bulkBusy !== null || moduleCount === 0}>
              {bulkBusy === "advance" ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
              +1 месяц
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => bulk("full")} disabled={bulkBusy !== null}>
              <InfinityIcon />
              Весь курс
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => bulk("suspend")} disabled={bulkBusy !== null}>
              <Pause />
              Приостановить
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => bulk("activate")} disabled={bulkBusy !== null}>
              <Play />
              Возобновить
            </Button>
            {confirmBulkRemove ? (
              <Button type="button" size="sm" variant="destructive" onClick={() => bulk("remove")} disabled={bulkBusy !== null}>
                {bulkBusy === "remove" ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Точно отписать {selected.size}?
              </Button>
            ) : (
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmBulkRemove(true)} disabled={bulkBusy !== null}>
                <Trash2 />
                Отписать
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => {
                setSelected(new Set());
                setConfirmBulkRemove(false);
              }}
            >
              <X />
              Отмена
            </Button>
          </div>
        </div>
      ) : null}

      <AddStudentsSheet
        open={sheet === "students"}
        onOpenChange={(o) => setSheet(o ? "students" : null)}
        courseId={roster.course.id}
        moduleCount={moduleCount}
        students={students}
        activeStudentIds={activeStudentIds}
        onDone={setNotice}
      />
      <AddGroupSheet
        open={sheet === "group"}
        onOpenChange={(o) => setSheet(o ? "group" : null)}
        courseId={roster.course.id}
        moduleCount={moduleCount}
        groups={groups}
        onDone={setNotice}
      />
    </div>
  );
}
