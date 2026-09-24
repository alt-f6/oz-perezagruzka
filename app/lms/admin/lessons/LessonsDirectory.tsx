"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Eye, EyeOff, FolderInput, Loader2, Pencil, Plus, Send, UserPlus, X } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { pluralRu } from "@/lms/lib/admin-format";
import type { DirectoryCourse, DirectoryLesson, DirectoryModule } from "@/lms/server/admin/catalog";
import { ContentChips, EmptyState, ExamPill, RatioBar, StatusPill, TagPill } from "@/lms/components/admin/primitives";

type ModuleOption = { id: string; title: string; courseTitle: string };

type Props = {
  courses: DirectoryCourse[];
  moduleOptions: ModuleOption[];
  editable: boolean;
  canAssign: boolean;
  filtered: boolean;
};

function unlockLabel(m: DirectoryModule): string {
  if (m.unlockMode === "DRIP_ENROLLMENT") {
    const d = m.unlockAfterDays ?? 0;
    return d === 0 ? "Сразу после записи" : `Через ${d} ${pluralRu(d, ["день", "дня", "дней"])} после записи`;
  }
  if (m.unlockMode === "FIXED_DATE" && m.unlockAt) {
    return `С ${new Date(m.unlockAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`;
  }
  return "Открывается вручную";
}

function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={(e) => onChange(e.target.checked)}
      className="relative z-10 size-4 cursor-pointer rounded accent-primary"
    />
  );
}

function IconAction({
  href,
  label,
  icon: Icon,
  external = false,
}: {
  href: string;
  label: string;
  icon: typeof Pencil;
  external?: boolean;
}) {
  const className =
    "relative z-10 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" title={label} aria-label={label} className={className}>
      <Icon className="size-4" />
    </a>
  ) : (
    <Link href={href} title={label} aria-label={label} className={className}>
      <Icon className="size-4" />
    </Link>
  );
}

function LessonRow({
  lesson,
  editable,
  canAssign,
  selected,
  onSelect,
}: {
  lesson: DirectoryLesson;
  editable: boolean;
  canAssign: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  const primaryHref = editable ? `/admin/lessons/${lesson.id}` : `/student/lessons/${lesson.id}`;

  return (
    <li
      className={cn(
        "group relative flex min-h-11 items-center gap-3 border-t border-border px-3 py-1.5 transition-colors",
        selected ? "bg-primary/10" : "hover:bg-accent/50",
      )}
    >
      {selected ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-primary" /> : null}

      {editable ? <Checkbox checked={selected} onChange={onSelect} label={`Выбрать «${lesson.title}»`} /> : null}

      <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">{lesson.order}</span>

      <div className="min-w-0 flex-1">
        <Link
          href={primaryHref}
          target={editable ? undefined : "_blank"}
          className="block truncate text-sm font-medium text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
        >
          {lesson.title || "Без названия"}
        </Link>
        {lesson.description ? (
          <p className="truncate text-xs text-muted-foreground">{lesson.description}</p>
        ) : null}
      </div>

      <div className="hidden shrink-0 md:block">
        <ContentChips kinds={lesson.kinds} />
      </div>

      <span
        className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums xl:block"
        title="Открыт напрямую отдельным ученикам (помимо записи на курс)"
      >
        {lesson.directAssignments > 0 ? `+${lesson.directAssignments} лично` : "—"}
      </span>

      <span className="w-28 shrink-0">
        <StatusPill published={lesson.isPublished} />
      </span>

      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        {editable ? <IconAction href={`/admin/lessons/${lesson.id}`} label="Редактировать" icon={Pencil} /> : null}
        <IconAction href={`/student/lessons/${lesson.id}`} label="Предпросмотр как ученик" icon={Eye} external />
        {canAssign ? (
          <IconAction href={`/admin/assignments?lessonId=${lesson.id}`} label="Открыть доступ ученикам" icon={UserPlus} />
        ) : null}
      </div>
    </li>
  );
}

function ModuleBlock({
  module,
  editable,
  canAssign,
  selected,
  toggle,
  toggleMany,
}: {
  module: DirectoryModule;
  editable: boolean;
  canAssign: boolean;
  selected: Set<string>;
  toggle: (id: string, checked: boolean) => void;
  toggleMany: (ids: string[], checked: boolean) => void;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const ids = module.lessons.map((l) => l.id);
  const selectedCount = ids.filter((id) => selected.has(id)).length;

  async function createLesson() {
    setCreating(true);
    const r = await fetch("/api/admin/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_id: module.id }),
    });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.lesson?.id) router.push(`/admin/lessons/${j.lesson.id}`);
    else setCreating(false);
  }

  return (
    <div className="border-t border-border first:border-t-0">
      <div className="flex min-h-10 items-center gap-3 bg-muted/40 px-3 py-1.5">
        {editable && ids.length > 0 ? (
          <Checkbox
            checked={selectedCount === ids.length}
            indeterminate={selectedCount > 0 && selectedCount < ids.length}
            onChange={(c) => toggleMany(ids, c)}
            label={`Выбрать все уроки модуля «${module.title}»`}
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="truncate text-sm font-semibold text-foreground">{module.title}</span>
          <span className="text-xs text-muted-foreground">{unlockLabel(module)}</span>
          {!module.isPublished ? <TagPill tone="warning">Модуль скрыт</TagPill> : null}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {module.lessons.length} {pluralRu(module.lessons.length, ["урок", "урока", "уроков"])}
        </span>
        {editable ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={createLesson} disabled={creating}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            Урок
          </Button>
        ) : null}
      </div>

      {module.lessons.length === 0 ? (
        <p className="border-t border-border px-3 py-3 text-xs text-muted-foreground">В модуле пока нет уроков.</p>
      ) : (
        <ul>
          {module.lessons.map((l) => (
            <LessonRow
              key={l.id}
              lesson={l}
              editable={editable}
              canAssign={canAssign}
              selected={selected.has(l.id)}
              onSelect={(c) => toggle(l.id, c)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CourseGroup({
  course,
  open,
  onToggle,
  ...rest
}: {
  course: DirectoryCourse;
  open: boolean;
  onToggle: () => void;
  editable: boolean;
  canAssign: boolean;
  selected: Set<string>;
  toggle: (id: string, checked: boolean) => void;
  toggleMany: (ids: string[], checked: boolean) => void;
}) {
  const panelId = `course-${course.id}`;
  const title = course.isUncategorized ? "Без курса / Неразобранное" : course.title;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border bg-card",
        course.isUncategorized ? "border-dashed border-warning/40" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none"
      >
        <ChevronRight
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
        <span className="min-w-0 truncate font-semibold text-foreground">{title}</span>
        <span className="flex flex-wrap items-center gap-1">
          <ExamPill examType={course.examType} />
          {course.subject ? <TagPill tone="sky">{course.subject}</TagPill> : null}
          {course.grade ? <TagPill>{course.grade} класс</TagPill> : null}
          {course.isUncategorized ? <TagPill tone="warning">Разложите уроки по курсам</TagPill> : null}
        </span>
        <span className="ml-auto flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
          <span className="hidden sm:inline">
            {course.activeEnrollments} {pluralRu(course.activeEnrollments, ["ученик", "ученика", "учеников"])}
          </span>
          <span>
            {course.publishedLessons}/{course.totalLessons} опубл.
          </span>
          <span className="hidden w-24 md:block">
            <RatioBar value={course.publishedLessons} total={course.totalLessons} label="Опубликовано уроков" />
          </span>
        </span>
      </button>

      {open ? (
        <div id={panelId} className="border-t border-border">
          {course.modules.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              В курсе нет модулей. Создайте модуль в карточке любого урока (раздел «Курс и модуль»).
            </p>
          ) : (
            course.modules.map((m) => <ModuleBlock key={m.id} module={m} {...rest} />)
          )}
        </div>
      ) : null}
    </section>
  );
}

function BulkBar({
  count,
  moduleOptions,
  onClear,
  onDone,
  ids,
}: {
  count: number;
  moduleOptions: ModuleOption[];
  onClear: () => void;
  onDone: () => void;
  ids: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byCourse = useMemo(() => {
    const groups = new Map<string, ModuleOption[]>();
    for (const m of moduleOptions) groups.set(m.courseTitle, [...(groups.get(m.courseTitle) ?? []), m]);
    return [...groups.entries()];
  }, [moduleOptions]);

  async function run(action: "publish" | "unpublish" | "move", moduleId?: string) {
    setBusy(action);
    setError(null);
    const r = await fetch("/api/admin/lessons/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids, module_id: moduleId }),
    });
    const j = await r.json().catch(() => null);
    setBusy(null);
    if (!r.ok || !j?.ok) {
      setError("Не удалось выполнить действие");
      return;
    }
    onDone();
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="region"
      aria-label="Действия с выбранными уроками"
      className="fixed inset-x-0 bottom-0 z-40 px-4 lg:left-60"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 rounded-lg border border-border-strong bg-popover px-3 py-2 shadow-2xl shadow-black/60">
        <span className="mr-1 text-sm font-medium text-foreground tabular-nums">
          Выбрано: {count}
        </span>
        <Button type="button" size="sm" onClick={() => run("publish")} disabled={busy !== null}>
          {busy === "publish" ? <Loader2 className="animate-spin" /> : <Send />}
          Опубликовать
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => run("unpublish")} disabled={busy !== null}>
          {busy === "unpublish" ? <Loader2 className="animate-spin" /> : <EyeOff />}
          Снять с публикации
        </Button>
        <Select value="" onValueChange={(moduleId) => run("move", moduleId)} disabled={busy !== null}>
          <SelectTrigger className="h-9 w-auto min-w-48 gap-2" aria-label="Переместить в модуль">
            {busy === "move" ? <Loader2 className="size-4 animate-spin" /> : <FolderInput className="size-4 text-muted-foreground" />}
            <SelectValue placeholder="Переместить в модуль…" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {byCourse.map(([courseTitle, modules]) => (
              <SelectGroup key={courseTitle}>
                <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {courseTitle}
                </p>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
          <X />
          Отмена
        </Button>
        {error ? (
          <p role="alert" className="w-full text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function LessonsDirectory({ courses, moduleOptions, editable, canAssign, filtered }: Props) {
  // With filters on (or only a few courses) show everything; otherwise open
  // just the first group (the "Без курса" inbox is pinned first).
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(filtered || courses.length <= 3 ? courses.map((c) => c.id) : courses.slice(0, 1).map((c) => c.id)),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleMany = (ids: string[], checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  if (courses.length === 0) {
    return (
      <EmptyState
        title={filtered ? "Ничего не найдено" : "Уроков пока нет"}
        description={
          filtered
            ? "Попробуйте изменить запрос или сбросить фильтры. Фильтры по экзамену и предмету работают только для курсов, у которых они заполнены."
            : editable
              ? "Создайте первый урок кнопкой «Создать урок»."
              : "За вами пока не закреплено ни одного курса."
        }
      />
    );
  }

  const allOpen = open.size === courses.length;

  return (
    <div className={cn("flex flex-col gap-3", selected.size > 0 && "pb-24")}>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(allOpen ? new Set() : new Set(courses.map((c) => c.id)))}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {allOpen ? "Свернуть все" : "Развернуть все"}
        </button>
      </div>

      {courses.map((c) => (
        <CourseGroup
          key={c.id}
          course={c}
          open={open.has(c.id)}
          onToggle={() =>
            setOpen((prev) => {
              const next = new Set(prev);
              if (next.has(c.id)) next.delete(c.id);
              else next.add(c.id);
              return next;
            })
          }
          editable={editable}
          canAssign={canAssign}
          selected={selected}
          toggle={toggle}
          toggleMany={toggleMany}
        />
      ))}

      {editable && selected.size > 0 ? (
        <BulkBar
          count={selected.size}
          ids={[...selected]}
          moduleOptions={moduleOptions}
          onClear={() => setSelected(new Set())}
          onDone={() => setSelected(new Set())}
        />
      ) : null}
    </div>
  );
}
