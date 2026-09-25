"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Plus } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { EXAM_TYPE_LABELS, EXAM_TYPE_VALUES, GRADE_VALUES, SUBJECT_VALUES } from "@/shared/lib/education";
import { pluralRu } from "@/lms/lib/admin-format";
import type { CourseOwnerOption, CourseSummary } from "@/lms/server/admin/catalog";
import { Panel, PanelHeader, RatioBar, TagPill } from "@/lms/components/admin/primitives";

// Radix Select can't hold "", so this sentinel means "not set".
const NONE = "__none__";

const ROLE_SHORT: Record<string, string> = { TEACHER: "преподаватель", ADMIN: "админ", MANAGER: "куратор" };

const ERRORS: Record<string, string> = {
  title_required: "Укажите название курса",
  invalid_subject: "Неизвестный предмет",
  invalid_exam_type: "Неизвестный экзамен",
  invalid_grade: "Класс должен быть от 8 до 11",
  invalid_teacher: "Этого сотрудника нельзя назначить владельцем",
};

const TEACHER_LINK_ERRORS: Record<string, string> = {
  invalid_teacher: "Можно выбрать только активных преподавателей",
};

function FacetSelect({
  value,
  onChange,
  placeholder,
  options,
  label,
  className,
  disabled,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)} disabled={disabled}>
      <SelectTrigger className={className ?? "h-8 w-40"} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          <span className="text-muted-foreground">{placeholder}</span>
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Multi-select of the TEACHER users explicitly linked to a course
 * (CourseTeacher). Each toggle saves the full set; a failed save rolls back.
 */
function CourseTeachersPicker({ courseId, initial, teachers }: { courseId: string; initial: string[]; teachers: CourseOwnerOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(initial);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function toggle(teacherId: string) {
    const previous = selected;
    const next = previous.includes(teacherId) ? previous.filter((id) => id !== teacherId) : [...previous, teacherId];
    setSelected(next);
    setSaving(true);
    setError(null);

    const r = await fetch(`/api/admin/courses/${courseId}/teachers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_ids: next }),
    });
    const j = await r.json().catch(() => null);
    setSaving(false);

    if (!r.ok || !j?.ok) {
      setSelected(previous);
      setError(TEACHER_LINK_ERRORS[j?.error] ?? "Не удалось сохранить");
      return;
    }
    startTransition(() => router.refresh());
  }

  const names = teachers.filter((t) => selected.includes(t.id)).map((t) => t.fullName);
  const label = names.length === 0 ? "Не назначены" : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Преподаватели курса"
        className="flex h-8 w-52 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className={names.length === 0 ? "truncate text-muted-foreground" : "truncate"}>{label}</span>
        {saving ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Сохранение" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-80 w-64 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          {teachers.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Нет активных преподавателей</p>
          ) : (
            teachers.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selected.includes(t.id)}
                  disabled={saving}
                  onChange={() => void toggle(t.id)}
                />
                <span className="truncate">{t.fullName}</span>
              </label>
            ))
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const SUBJECT_OPTIONS = SUBJECT_VALUES.map((s) => ({ value: s, label: s }));
const EXAM_OPTIONS = EXAM_TYPE_VALUES.map((e) => ({ value: e, label: EXAM_TYPE_LABELS[e] }));
const GRADE_OPTIONS = GRADE_VALUES.map((g) => ({ value: String(g), label: `${g} класс` }));

function CourseRow({
  course,
  owners,
  teachers,
}: {
  course: CourseSummary;
  owners: CourseOwnerOption[];
  teachers: CourseOwnerOption[];
}) {
  const router = useRouter();
  const [state, setState] = useState(course);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function patch(body: Record<string, unknown>, optimistic: Partial<CourseSummary>) {
    const previous = state;
    setState({ ...state, ...optimistic });
    setStatus("saving");
    setError(null);

    const r = await fetch(`/api/admin/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      setState(previous);
      setStatus("idle");
      setError(ERRORS[j?.error] ?? "Не удалось сохранить");
      return;
    }
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1500);
    startTransition(() => router.refresh());
  }

  return (
    <TableRow className={course.isUncategorized ? "bg-warning/5" : undefined}>
      <TableCell className="min-w-64">
        <div className="flex items-center gap-2">
          <Link href={`/admin/lessons?course=${course.id}`} className="font-medium text-foreground hover:underline">
            {course.isUncategorized ? "Без курса / Неразобранное" : state.title}
          </Link>
          {status === "saving" ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Сохранение" /> : null}
          {status === "saved" ? <Check className="size-3.5 text-success" aria-label="Сохранено" /> : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {state.moduleCount} {pluralRu(state.moduleCount, ["модуль", "модуля", "модулей"])} · {state.lessonCount}{" "}
          {pluralRu(state.lessonCount, ["урок", "урока", "уроков"])} · {state.activeEnrollments}{" "}
          {pluralRu(state.activeEnrollments, ["ученик", "ученика", "учеников"])}
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </TableCell>

      {course.isUncategorized ? (
        <TableCell colSpan={5}>
          <TagPill tone="warning">Служебная корзина для уроков без курса — перенесите их в нужные модули в разделе «Уроки»</TagPill>
        </TableCell>
      ) : (
        <>
          <TableCell>
            <FacetSelect
              label="Предмет"
              placeholder="Не указан"
              value={state.subject}
              options={SUBJECT_OPTIONS}
              onChange={(subject) => patch({ subject }, { subject })}
            />
          </TableCell>
          <TableCell>
            <FacetSelect
              label="Экзамен"
              placeholder="—"
              className="h-8 w-24"
              value={state.examType}
              options={EXAM_OPTIONS}
              onChange={(examType) => patch({ exam_type: examType }, { examType })}
            />
          </TableCell>
          <TableCell>
            <FacetSelect
              label="Класс"
              placeholder="—"
              className="h-8 w-28"
              value={state.grade ? String(state.grade) : null}
              options={GRADE_OPTIONS}
              onChange={(g) => patch({ grade: g }, { grade: g ? Number(g) : null })}
            />
          </TableCell>
          <TableCell>
            <Select
              value={state.teacherId}
              onValueChange={(teacherId) =>
                patch(
                  { teacher_id: teacherId },
                  { teacherId, teacherName: owners.find((o) => o.id === teacherId)?.fullName ?? state.teacherName },
                )
              }
            >
              <SelectTrigger className="h-8 w-52" aria-label="Преподаватель курса">
                <SelectValue>{state.teacherName}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {owners.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.fullName} <span className="text-muted-foreground">· {ROLE_SHORT[o.role] ?? o.role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            <CourseTeachersPicker courseId={course.id} initial={course.linkedTeacherIds} teachers={teachers} />
          </TableCell>
        </>
      )}

      <TableCell className="w-32">
        <RatioBar value={state.publishedLessonCount} total={state.lessonCount} label="Опубликовано уроков" />
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {state.publishedLessonCount}/{state.lessonCount} опубл.
        </p>
      </TableCell>

      <TableCell className="w-24 text-right">
        <Switch
          checked={state.isPublished}
          onCheckedChange={(isPublished) => patch({ is_published: isPublished }, { isPublished })}
          aria-label="Курс опубликован"
        />
      </TableCell>
    </TableRow>
  );
}

function CreateCourseForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [examType, setExamType] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);

    const r = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, subject, exam_type: examType, grade }),
    });
    const j = await r.json().catch(() => null);
    setSaving(false);

    if (!r.ok || !j?.ok) {
      setError(ERRORS[j?.error] ?? "Не удалось создать курс");
      return;
    }
    setTitle("");
    setSubject(null);
    setExamType(null);
    setGrade(null);
    router.refresh();
  }

  return (
    <Panel>
      <PanelHeader title="Новый курс" />
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2 p-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: Математика ЕГЭ (Профиль)"
          aria-label="Название курса"
          className="h-9 min-w-64 flex-1"
        />
        <FacetSelect label="Предмет" placeholder="Предмет" className="h-9 w-40" value={subject} options={SUBJECT_OPTIONS} onChange={setSubject} />
        <FacetSelect label="Экзамен" placeholder="Экзамен" className="h-9 w-28" value={examType} options={EXAM_OPTIONS} onChange={setExamType} />
        <FacetSelect label="Класс" placeholder="Класс" className="h-9 w-28" value={grade} options={GRADE_OPTIONS} onChange={setGrade} />
        <Button type="submit" size="sm" className="h-9" disabled={!title.trim()} loading={saving}>
          {saving ? null : <Plus />}
          Создать
        </Button>
        {error ? (
          <p role="alert" className="w-full text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </Panel>
  );
}

export function CoursesClient({ courses, owners }: { courses: CourseSummary[]; owners: CourseOwnerOption[] }) {
  const sorted = [...courses].sort((a, b) => Number(b.isUncategorized) - Number(a.isUncategorized));
  const teachers = owners.filter((o) => o.role === "TEACHER");
  const missingFacets = courses.filter((c) => !c.isUncategorized && (!c.subject || !c.examType)).length;

  return (
    <div className="flex flex-col gap-4">
      <CreateCourseForm />

      {missingFacets > 0 ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          У {missingFacets} {pluralRu(missingFacets, ["курса", "курсов", "курсов"])} не указан предмет или экзамен — такие
          курсы не попадают в фильтры на странице «Уроки».
        </p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Курс</TableHead>
            <TableHead>Предмет</TableHead>
            <TableHead>Экзамен</TableHead>
            <TableHead>Класс</TableHead>
            <TableHead>Владелец</TableHead>
            <TableHead>Преподаватели курса</TableHead>
            <TableHead>Уроки</TableHead>
            <TableHead className="text-right">Опубликован</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                Курсов пока нет — создайте первый выше.
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((c) => <CourseRow key={c.id} course={c} owners={owners} teachers={teachers} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}
