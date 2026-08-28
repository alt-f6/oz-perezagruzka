"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

type Student = { id: string; email: string | null; fullName: string | null; role: string };
type Lesson = {
  id: string;
  title: string;
  isPublished: boolean;
  order: number;
  module: { title: string; course: { title: string } } | null;
};

type ApiPayload = {
  ok: boolean;
  students: Student[];
  lessons: Lesson[];
  assignedLessonIds: string[];
  error?: string;
};

function formatStudentLabel(st: Student): string {
  if (st.fullName && st.email) return `${st.fullName} (${st.email})`;
  if (st.fullName) return st.fullName;
  if (st.email) return st.email;
  return "Ученик без имени";
}

export default function AdminAssignmentsClient({
  initialStudentId,
}: {
  initialStudentId: string | null;
}) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [studentId, setStudentId] = useState<string | null>(initialStudentId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [serverAssigned, setServerAssigned] = useState<Set<string>>(new Set());

  const dirty = useMemo(() => {
    if (!studentId) return false;
    if (selected.size !== serverAssigned.size) return true;
    for (const id of selected) if (!serverAssigned.has(id)) return true;
    return false;
  }, [studentId, selected, serverAssigned]);

  async function load(studentIdToLoad: string | null) {
    setLoading(true);
    setErr(null);

    const url = studentIdToLoad
      ? `/api/admin/assignments?studentId=${studentIdToLoad}`
      : `/api/admin/assignments`;

    const r = await fetch(url, { method: "GET" });
    const j = (await r.json().catch(() => null)) as ApiPayload | null;

    if (!r.ok || !j?.ok) {
      setErr(j?.error || "Не удалось загрузить данные");
      setLoading(false);
      return;
    }

    setStudents(j.students || []);
    setLessons(j.lessons || []);

    const ids = j.assignedLessonIds || [];
    const s = new Set<string>(ids);

    setServerAssigned(s);
    setSelected(new Set<string>(ids));

    setLoading(false);
  }

  useEffect(() => {
    load(studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onChangeStudent(nextIdRaw: string) {
    const safe = nextIdRaw ? nextIdRaw : null;

    setStudentId(safe);

    if (safe) router.push(`/admin/assignments?studentId=${safe}`);
    else router.push(`/admin/assignments`);

    await load(safe);
  }

  function toggleLesson(lessonId: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(lessonId)) n.delete(lessonId);
      else n.add(lessonId);
      return n;
    });
  }

  function selectAllPublished() {
    setSelected(new Set(lessons.filter((l) => l.isPublished).map((l) => l.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function save() {
    if (!studentId) {
      setErr("Сначала выбери студента");
      return;
    }

    setSaving(true);
    setErr(null);

    const lessonIds = Array.from(selected);

    const r = await fetch(`/api/admin/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set", studentId, lessonIds }),
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      setErr(j?.error || "Не удалось сохранить назначения");
      setSaving(false);
      return;
    }

    setServerAssigned(new Set<string>(lessonIds));
    setSelected(new Set<string>(lessonIds));
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl animate-pulse px-6 py-8">
        <div className="h-40 rounded-2xl bg-white/[0.06]" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Админ панель
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Назначения уроков</h1>
          <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
            Выбираешь студента и отмечаешь, какие уроки ему доступны. Сохраняется одной кнопкой.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={studentId ? String(studentId) : ""} onValueChange={onChangeStudent}>
            <SelectTrigger className="min-w-64">
              <SelectValue placeholder="Выбери студента" />
            </SelectTrigger>
            <SelectContent>
              {students.map((st) => (
                <SelectItem key={st.id} value={String(st.id)}>
                  {formatStudentLabel(st)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => load(studentId)} disabled={saving}>
            Обновить
          </Button>
          <Button variant="outline" size="sm" onClick={selectAllPublished} disabled={!studentId || saving}>
            Выбрать все опубликованные
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} disabled={!studentId || saving}>
            Снять все
          </Button>
          <Button
            size="sm"
            variant={dirty ? "default" : "outline"}
            onClick={save}
            disabled={!studentId || saving || !dirty}
            loading={saving}
          >
            {saving ? "Сохранение..." : dirty ? "Сохранить" : "Сохранено"}
          </Button>
        </div>
      </div>

      {err ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive-foreground"
        >
          {err}
        </p>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Order</TableHead>
            <TableHead>Урок</TableHead>
            <TableHead className="w-40">Статус</TableHead>
            <TableHead className="w-36">Доступ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lessons.map((l) => {
            const checked = selected.has(l.id);
            return (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-muted-foreground">{l.order ?? 0}</TableCell>

                <TableCell>
                  <div className="flex flex-col">
                    <span className="truncate font-bold">{l.title}</span>
                    {l.module?.course.title ? (
                      <span className="truncate text-xs text-muted-foreground">
                        Курс: {l.module.course.title}
                      </span>
                    ) : null}
                  </div>
                </TableCell>

                <TableCell>
                  {l.isPublished ? (
                    <Badge variant="success">Опубликован</Badge>
                  ) : (
                    <Badge variant="secondary">Черновик</Badge>
                  )}
                </TableCell>

                <TableCell>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!studentId}
                      checked={checked}
                      onChange={() => toggleLesson(l.id)}
                      className="size-4 accent-primary"
                    />
                    <span className={studentId ? "text-foreground" : "text-muted-foreground"}>
                      {checked ? "Назначен" : "Не назначен"}
                    </span>
                  </label>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="mt-3 text-xs text-muted-foreground">
        Подсказка: черновики можно назначать, но студент их всё равно не увидит, пока урок не опубликован.
      </p>
    </main>
  );
}
