"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

export type Lesson = {
  id: string;
  title: string;
  description: string;
  content: string;
  is_published: boolean;
  order: number;
  practice_link_url: string | null;
  practice_link_label: string | null;
  presentation_embed_url: string | null;
  homework_task: string | null;
  module_id: string;
};

type Course = { id: string; title: string; isPublished: boolean };
type Module = { id: string; title: string; order: number; unlockMode: "MANUAL" | "DRIP_ENROLLMENT" | "FIXED_DATE" };

type UnlockMode = "MANUAL" | "DRIP_ENROLLMENT" | "FIXED_DATE";

type Props = {
  lesson: Lesson;
  onChange: (lesson: Lesson) => void;
  onSave: () => void;
  onRefresh: () => void;
  saving: boolean;
  error: string | null;
};

export function LessonMetadataForm({ lesson, onChange, onSave, onRefresh, saving, error }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [modules, setModules] = useState<Module[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);

  const [showNewCourseForm, setShowNewCourseForm] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDescription, setNewCourseDescription] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourseError, setNewCourseError] = useState<string | null>(null);

  const [showNewModuleForm, setShowNewModuleForm] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleDescription, setNewModuleDescription] = useState("");
  const [newModuleUnlockMode, setNewModuleUnlockMode] = useState<UnlockMode>("MANUAL");
  const [newModuleUnlockAfterDays, setNewModuleUnlockAfterDays] = useState<number>(0);
  const [newModuleUnlockAt, setNewModuleUnlockAt] = useState<string>("");
  const [creatingModule, setCreatingModule] = useState(false);
  const [newModuleError, setNewModuleError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/courses", { method: "GET" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setCourses(j.courses as Course[]);
    })();
  }, []);

  useEffect(() => {
    if (!courseId) {
      setModules([]);
      return;
    }

    setModulesLoading(true);
    (async () => {
      const r = await fetch(`/api/admin/courses/${courseId}/modules`, { method: "GET" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setModules(j.modules as Module[]);
      setModulesLoading(false);
    })();
  }, [courseId]);

  async function createCourse() {
    if (!newCourseTitle.trim()) return;
    setCreatingCourse(true);
    setNewCourseError(null);

    const r = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newCourseTitle, description: newCourseDescription }),
    });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      setNewCourseError(j?.error || "Не удалось создать курс");
      setCreatingCourse(false);
      return;
    }

    const created = j.course as Course;
    setCourses((prev) => [...prev, created]);
    setCourseId(created.id);

    setShowNewCourseForm(false);
    setNewCourseTitle("");
    setNewCourseDescription("");
    setCreatingCourse(false);
  }

  async function createModule() {
    if (!courseId || !newModuleTitle.trim()) return;
    setCreatingModule(true);
    setNewModuleError(null);

    const r = await fetch(`/api/admin/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newModuleTitle,
        description: newModuleDescription,
        unlockMode: newModuleUnlockMode,
        unlockAfterDays: newModuleUnlockMode === "DRIP_ENROLLMENT" ? newModuleUnlockAfterDays : undefined,
        unlockAt: newModuleUnlockMode === "FIXED_DATE" ? newModuleUnlockAt : undefined,
      }),
    });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      setNewModuleError(j?.error || "Не удалось создать модуль");
      setCreatingModule(false);
      return;
    }

    setModules((prev) => [...prev, j.module as Module]);
    onChange({ ...lesson, module_id: (j.module as Module).id });

    setShowNewModuleForm(false);
    setNewModuleTitle("");
    setNewModuleDescription("");
    setNewModuleUnlockMode("MANUAL");
    setNewModuleUnlockAfterDays(0);
    setNewModuleUnlockAt("");
    setCreatingModule(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Редактирование урока</CardTitle>
        <CardDescription>Содержание урока и видеоматериалы хранятся отдельно. Порядок видео по-прежнему важен.</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
          <div className="grid gap-1.5">
            <Label htmlFor="lesson-title">Название</Label>
            <Input
              id="lesson-title"
              value={lesson.title}
              onChange={(e) => onChange({ ...lesson, title: e.target.value })}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="lesson-order">Порядок</Label>
            <Input
              id="lesson-order"
              type="number"
              value={Number(lesson.order ?? 0)}
              onChange={(e) => onChange({ ...lesson, order: Number(e.target.value) })}
            />
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="lesson-description">Описание</Label>
            <Textarea
              id="lesson-description"
              className="min-h-24"
              value={lesson.description}
              onChange={(e) => onChange({ ...lesson, description: e.target.value })}
            />
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="lesson-content">Содержание</Label>
            <Textarea
              id="lesson-content"
              className="min-h-60"
              value={lesson.content}
              onChange={(e) => onChange({ ...lesson, content: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              id="lesson-published"
              checked={!!lesson.is_published}
              onCheckedChange={(checked) => onChange({ ...lesson, is_published: checked })}
            />
            <Label htmlFor="lesson-published" className="cursor-pointer normal-case tracking-normal text-foreground">
              Опубликован
            </Label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="lesson-course">Курс</Label>
              <div className="flex gap-2">
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger id="lesson-course" className="flex-1">
                    <SelectValue placeholder="Выберите курс" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewCourseForm((v) => !v)}
                >
                  {showNewCourseForm ? "Отмена" : "+ Новый курс"}
                </Button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="lesson-module">Модуль</Label>
              <Select
                value={lesson.module_id ?? ""}
                onValueChange={(value) => onChange({ ...lesson, module_id: value })}
                disabled={!courseId || modulesLoading}
              >
                <SelectTrigger id="lesson-module">
                  <SelectValue placeholder={modulesLoading ? "Загрузка..." : "Выберите модуль"} />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showNewCourseForm ? (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-black/10 p-3 sm:col-span-2 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-course-title">Название курса</Label>
                  <Input
                    id="new-course-title"
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-course-description">Описание курса (необязательно)</Label>
                  <Textarea
                    id="new-course-description"
                    className="min-h-16"
                    value={newCourseDescription}
                    onChange={(e) => setNewCourseDescription(e.target.value)}
                  />
                </div>

                {newCourseError ? (
                  <p role="alert" className="text-sm text-destructive-foreground sm:col-span-2">
                    {newCourseError}
                  </p>
                ) : null}

                <div className="flex justify-end sm:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={createCourse}
                    loading={creatingCourse}
                    disabled={!newCourseTitle.trim()}
                  >
                    Создать курс
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewModuleForm((v) => !v)}
                disabled={!courseId}
              >
                {showNewModuleForm ? "Отмена" : "+ Новый модуль"}
              </Button>
            </div>

            {showNewModuleForm ? (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-black/10 p-3 sm:col-span-2 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-module-title">Название модуля</Label>
                  <Input
                    id="new-module-title"
                    value={newModuleTitle}
                    onChange={(e) => setNewModuleTitle(e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="new-module-description">Описание</Label>
                  <Textarea
                    id="new-module-description"
                    className="min-h-16"
                    value={newModuleDescription}
                    onChange={(e) => setNewModuleDescription(e.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="new-module-unlock-mode">Режим открытия</Label>
                  <Select
                    value={newModuleUnlockMode}
                    onValueChange={(value) => setNewModuleUnlockMode(value as UnlockMode)}
                  >
                    <SelectTrigger id="new-module-unlock-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANUAL">Вручную</SelectItem>
                      <SelectItem value="DRIP_ENROLLMENT">По расписанию (дней после зачисления)</SelectItem>
                      <SelectItem value="FIXED_DATE">Фиксированная дата</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newModuleUnlockMode === "DRIP_ENROLLMENT" ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-module-unlock-days">Открыть через (дней)</Label>
                    <Input
                      id="new-module-unlock-days"
                      type="number"
                      value={newModuleUnlockAfterDays}
                      onChange={(e) => setNewModuleUnlockAfterDays(Number(e.target.value))}
                    />
                  </div>
                ) : null}

                {newModuleUnlockMode === "FIXED_DATE" ? (
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-module-unlock-at">Дата открытия</Label>
                    <Input
                      id="new-module-unlock-at"
                      type="date"
                      value={newModuleUnlockAt}
                      onChange={(e) => setNewModuleUnlockAt(e.target.value)}
                    />
                  </div>
                ) : null}

                {newModuleError ? (
                  <p role="alert" className="text-sm text-destructive-foreground sm:col-span-2">
                    {newModuleError}
                  </p>
                ) : null}

                <div className="flex justify-end sm:col-span-2">
                  <Button type="button" size="sm" onClick={createModule} loading={creatingModule}>
                    Создать модуль
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="lesson-practice-link-url">Ссылка на практику / воркшоп</Label>
            <Input
              id="lesson-practice-link-url"
              type="url"
              placeholder="https://miro.com/app/board/..."
              value={lesson.practice_link_url ?? ""}
              onChange={(e) => onChange({ ...lesson, practice_link_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Отдельно от видеоссылок — для досок Miro, Google Docs, тренажёров или внешних тестов.
            </p>
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="lesson-practice-link-label">Подпись ссылки на практику (необязательно)</Label>
            <Input
              id="lesson-practice-link-label"
              placeholder="Открыть интерактивную практику"
              value={lesson.practice_link_label ?? ""}
              onChange={(e) => onChange({ ...lesson, practice_link_label: e.target.value })}
              disabled={!lesson.practice_link_url}
            />
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="lesson-presentation-embed">Ссылка на встроенную презентацию</Label>
            <Input
              id="lesson-presentation-embed"
              type="url"
              placeholder="https://docs.google.com/presentation/d/.../embed"
              value={lesson.presentation_embed_url ?? ""}
              onChange={(e) => onChange({ ...lesson, presentation_embed_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Для Google Slides / Miro и других слайд-дек с поддержкой iframe-встраивания. Оставьте пустым, если
              используется загруженная PDF-презентация.
            </p>
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="lesson-homework-task">Домашнее задание (Markdown)</Label>
            <Textarea
              id="lesson-homework-task"
              className="min-h-32"
              value={lesson.homework_task ?? ""}
              onChange={(e) => onChange({ ...lesson, homework_task: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Показывается ученику как основа домашнего задания. Отправка и проверка появятся во второй фазе.
            </p>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive-foreground"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={saving}>
            Обновить
          </Button>
          <Button type="button" onClick={onSave} loading={saving}>
            {saving ? "Сохранение..." : "Сохранить урок"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
