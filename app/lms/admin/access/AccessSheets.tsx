"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Minus, Plus, Search, UserPlus, Users } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { cn } from "@/shared/lib/utils";
import { EXAM_TYPE_LABELS, isExamType } from "@/shared/lib/education";
import { pluralRu } from "@/lms/lib/admin-format";
import type { GroupOption, StudentOption } from "@/lms/server/admin/access";

export type AccessValue = number | null;

/** "Весь курс" vs "первые N модулей" -- the abonement an enrollment starts with. */
export function AccessPicker({
  value,
  onChange,
  moduleCount,
}: {
  value: AccessValue;
  onChange: (v: AccessValue) => void;
  moduleCount: number;
}) {
  const limited = value !== null;
  const n = value ?? Math.min(1, moduleCount);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Доступ к модулям</legend>
      <div role="radiogroup" className="flex h-9 items-center rounded-md border border-input bg-black/20 p-0.5">
        {[
          { key: "all", label: "Весь курс", active: !limited, set: () => onChange(null) },
          { key: "limited", label: "По абонементу", active: limited, set: () => onChange(n) },
        ].map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={o.active}
            onClick={o.set}
            className={cn(
              "h-full flex-1 rounded px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              o.active ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {limited ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Открыть первые</span>
          <div className="flex items-center rounded-md border border-input">
            <button
              type="button"
              aria-label="Меньше модулей"
              className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={n <= 0}
              onClick={() => onChange(Math.max(0, n - 1))}
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-8 text-center font-semibold tabular-nums">{n}</span>
            <button
              type="button"
              aria-label="Больше модулей"
              className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={n >= moduleCount}
              onClick={() => onChange(Math.min(moduleCount, n + 1))}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <span className="text-muted-foreground">
            из {moduleCount} {pluralRu(moduleCount, ["модуля", "модулей", "модулей"])}
          </span>
        </div>
      ) : null}
    </fieldset>
  );
}

const ERRORS: Record<string, string> = {
  invalid_access: "Некорректное число модулей",
  not_students: "Среди выбранных есть не ученики",
  group_not_found: "Группа не найдена",
  course_not_found: "Курс не найден",
};

function useEnrollRequest() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok || !j?.ok) {
      setError(ERRORS[j?.error] ?? "Не удалось сохранить");
      return null;
    }
    router.refresh();
    return j;
  }

  return { busy, error, setError, send };
}

export function AddStudentsSheet({
  open,
  onOpenChange,
  courseId,
  moduleCount,
  students,
  activeStudentIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  moduleCount: number;
  students: StudentOption[];
  activeStudentIds: Set<string>;
  onDone: (message: string) => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [access, setAccess] = useState<AccessValue>(null);
  const { busy, error, send } = useEnrollRequest();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle
      ? students.filter((s) => s.fullName.toLowerCase().includes(needle) || s.email?.toLowerCase().includes(needle))
      : students;
  }, [q, students]);

  async function submit() {
    const j = await send(`/api/admin/courses/${courseId}/enrollments`, {
      student_ids: [...picked],
      access_through_module: access,
    });
    if (!j) return;
    setPicked(new Set());
    setQ("");
    onOpenChange(false);
    onDone(`Записано: ${j.created}${j.reactivated ? `, восстановлено: ${j.reactivated}` : ""}`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md bg-background">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4 text-primary-2" /> Записать учеников
          </SheetTitle>
          <SheetDescription>Выберите учеников с аккаунтом LMS. Уже записанным доступ только расширится.</SheetDescription>
        </SheetHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя или email…" className="h-9 pl-9" aria-label="Поиск ученика" />
        </div>

        <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Никого не найдено</li>
          ) : (
            filtered.map((s) => {
              const enrolled = activeStudentIds.has(s.id);
              const checked = picked.has(s.id);
              return (
                <li key={s.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-accent/50",
                      enrolled && "cursor-default opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      disabled={enrolled}
                      checked={checked}
                      onChange={(e) =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(s.id);
                          else next.delete(s.id);
                          return next;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{s.fullName}</span>
                      {s.email ? <span className="block truncate text-xs text-muted-foreground">{s.email}</span> : null}
                    </span>
                    {enrolled ? <span className="text-xs text-muted-foreground">уже записан</span> : null}
                  </label>
                </li>
              );
            })
          )}
        </ul>

        <AccessPicker value={access} onChange={setAccess} moduleCount={moduleCount} />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="button" onClick={submit} disabled={picked.size === 0 || busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />}
          Записать {picked.size > 0 ? `(${picked.size})` : ""}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

type Preview = {
  group: { id: string; name: string };
  to_enroll: { userId: string; fullName: string }[];
  already_enrolled: { userId: string; fullName: string }[];
  without_account: { studentId: string; fullName: string }[];
};

function NameList({ names, tone }: { names: string[]; tone?: "warning" }) {
  if (names.length === 0) return null;
  const shown = names.slice(0, 8);
  return (
    <p className={cn("text-xs", tone === "warning" ? "text-warning" : "text-muted-foreground")}>
      {shown.join(", ")}
      {names.length > shown.length ? ` и ещё ${names.length - shown.length}` : ""}
    </p>
  );
}

export function AddGroupSheet({
  open,
  onOpenChange,
  courseId,
  moduleCount,
  groups,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  moduleCount: number;
  groups: GroupOption[];
  onDone: (message: string) => void;
}) {
  const [groupId, setGroupId] = useState<string>("");
  const [access, setAccess] = useState<AccessValue>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const { busy, error, setError, send } = useEnrollRequest();

  // Dry-run whenever the group changes, so the admin sees exactly who will
  // be enrolled (and who can't be, for lack of an LMS account) before saving.
  useEffect(() => {
    if (!groupId) return;
    let alive = true;
    fetch(`/api/admin/courses/${courseId}/enrollments/group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId, dry_run: true }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok) setPreview(j as Preview);
        else setError(ERRORS[j?.error] ?? "Не удалось загрузить группу");
      })
      .catch(() => alive && setError("Не удалось загрузить группу"))
      .finally(() => alive && setLoadingPreview(false));
    return () => {
      alive = false;
    };
  }, [groupId, courseId, setError]);

  function pickGroup(id: string) {
    setPreview(null);
    setError(null);
    setLoadingPreview(true);
    setGroupId(id);
  }

  async function submit() {
    const j = await send(`/api/admin/courses/${courseId}/enrollments/group`, {
      group_id: groupId,
      access_through_module: access,
    });
    if (!j) return;
    onOpenChange(false);
    setGroupId("");
    setPreview(null);
    onDone(
      `Группа «${j.group.name}»: записано ${j.created}` +
        (j.reactivated ? `, восстановлено ${j.reactivated}` : "") +
        (j.without_account.length ? `, без аккаунта LMS: ${j.without_account.length}` : ""),
    );
  }

  const count = preview ? preview.to_enroll.length : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary-2" /> Записать группу из CRM
          </SheetTitle>
          <SheetDescription>
            Разовая запись текущего состава группы. Если состав группы потом изменится, записи на курс не поменяются.
          </SheetDescription>
        </SheetHeader>

        <Select value={groupId} onValueChange={pickGroup}>
          <SelectTrigger aria-label="Группа">
            <SelectValue placeholder="Выберите группу…" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
                <span className="text-muted-foreground">
                  {" "}
                  · {g.memberCount} {pluralRu(g.memberCount, ["ученик", "ученика", "учеников"])}
                  {isExamType(g.examType) ? ` · ${EXAM_TYPE_LABELS[g.examType]}` : ""}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loadingPreview ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Проверяем состав группы…
          </p>
        ) : preview ? (
          <div className="flex flex-col gap-3 rounded-md border border-border p-3 text-sm">
            <div>
              <p className="font-medium text-foreground">
                Будут записаны: {preview.to_enroll.length}
              </p>
              <NameList names={preview.to_enroll.map((s) => s.fullName)} />
            </div>
            {preview.already_enrolled.length > 0 ? (
              <div>
                <p className="text-muted-foreground">Уже на курсе: {preview.already_enrolled.length} (доступ может только расшириться)</p>
                <NameList names={preview.already_enrolled.map((s) => s.fullName)} />
              </div>
            ) : null}
            {preview.without_account.length > 0 ? (
              <div className="rounded bg-warning/10 p-2">
                <p className="flex items-center gap-1.5 font-medium text-warning">
                  <AlertTriangle className="size-3.5" /> Без аккаунта LMS: {preview.without_account.length}
                </p>
                <NameList names={preview.without_account.map((s) => s.fullName)} tone="warning" />
                <p className="mt-1 text-xs text-muted-foreground">Отправьте им приглашение в карточке ученика в CRM и запишите группу ещё раз.</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <AccessPicker value={access} onChange={setAccess} moduleCount={moduleCount} />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="button" onClick={submit} disabled={!preview || busy || count + preview.already_enrolled.length === 0}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />}
          {count > 0 ? `Записать ${count} ${pluralRu(count, ["ученика", "учеников", "учеников"])}` : "Применить доступ"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
