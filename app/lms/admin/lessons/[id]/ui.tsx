"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Music, Presentation, Video } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { LessonMetadataForm, type Lesson } from "./LessonMetadataForm";
import { LessonVideoManager } from "./LessonVideoManager";
import { LessonPdfManager } from "./LessonPdfManager";
import { LessonAudioManager } from "./LessonAudioManager";

type AssetFormat = "video" | "pdf" | "audio" | "presentation";

const FORMAT_TABS: { id: AssetFormat; label: string; icon: typeof Video }[] = [
  { id: "video", label: "Видео", icon: Video },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "audio", label: "Аудио", icon: Music },
  { id: "presentation", label: "Презентация", icon: Presentation },
];

function LessonPresentationPanel({ lesson }: { lesson: Lesson }) {
  const url = lesson.presentation_embed_url?.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Presentation</CardTitle>
        <CardDescription>
          Set the embed URL in the lesson fields above (Presentation embed URL) — no file upload for this format.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {url ? (
          <div className="aspect-video overflow-hidden rounded-xl border border-border bg-black">
            <iframe
              src={url}
              className="h-full w-full border-0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock;"
              allowFullScreen
              title="Presentation preview"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No presentation embed URL set yet. Add one in the lesson fields above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminLessonEditClient({ lessonId }: { lessonId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [activeFormat, setActiveFormat] = useState<AssetFormat>("video");

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
        practice_link_url: lesson.practice_link_url,
        practice_link_label: lesson.practice_link_label,
        presentation_embed_url: lesson.presentation_embed_url,
        homework_task: lesson.homework_task,
        module_id: lesson.module_id,
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

        <div role="tablist" aria-label="Формат материала" className="flex flex-wrap gap-2">
          {FORMAT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeFormat === id}
              onClick={() => setActiveFormat(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                activeFormat === id
                  ? "border-primary/40 bg-primary/15 text-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {activeFormat === "video" ? <LessonVideoManager lessonId={lessonId} /> : null}
        {activeFormat === "pdf" ? <LessonPdfManager lessonId={lessonId} /> : null}
        {activeFormat === "audio" ? <LessonAudioManager lessonId={lessonId} /> : null}
        {activeFormat === "presentation" ? <LessonPresentationPanel lesson={lesson} /> : null}
      </div>
    </main>
  );
}
