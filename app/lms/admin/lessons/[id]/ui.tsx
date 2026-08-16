"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { LessonMetadataForm, type Lesson } from "./LessonMetadataForm";
import { LessonVideoManager } from "./LessonVideoManager";
import { LessonPdfManager } from "./LessonPdfManager";

export default function AdminLessonEditClient({ lessonId }: { lessonId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);

  async function loadLesson() {
    setLoading(true);
    setError(null);

    const r = await fetch(`/api/admin/lessons/${lessonId}`, { method: "GET" });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      setError(j?.message || j?.error || "Failed to load lesson");
      setLoading(false);
      setLesson(null);
      return;
    }

    setLesson(j.lesson as Lesson);
    setLoading(false);
  }

  useEffect(() => {
    if (!lessonId) {
      setError("Invalid lesson ID");
      setLoading(false);
      setLesson(null);
      return;
    }

    loadLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function saveLesson() {
    if (!lesson) return;
    setSaving(true);
    setError(null);

    const r = await fetch(`/api/admin/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        order: lesson.order,
        is_published: lesson.is_published,
      }),
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      setError(j?.message || j?.error || "Failed to save lesson");
      setSaving(false);
      return;
    }

    setLesson(j.lesson as Lesson);
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl animate-pulse px-6 py-8">
        <div className="h-40 rounded-2xl bg-white/[0.06]" />
      </main>
    );
  }

  if (!lesson) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/admin/lessons" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← Back to lessons
        </Link>
        <Card className="mt-4">
          <CardContent className="pt-5">
            <p className="font-bold">Lesson not found</p>
            {error ? <p className="mt-1 text-sm text-muted-foreground">{error}</p> : null}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/lessons">Back</Link>
        </Button>

        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant="outline">ID: {lesson.id}</Badge>
          {lesson.is_published ? (
            <Badge variant="success">Published</Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <LessonMetadataForm
          lesson={lesson}
          onChange={setLesson}
          onSave={saveLesson}
          onRefresh={loadLesson}
          saving={saving}
          error={error}
        />

        <LessonVideoManager lessonId={lessonId} />

        <LessonPdfManager lessonId={lessonId} />
      </div>
    </main>
  );
}
