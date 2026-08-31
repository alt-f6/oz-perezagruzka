"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";

import type { VideoProvider } from "@/lms/lib/video-url";

const PROVIDER_LABELS: Record<VideoProvider, string> = {
  vk: "VK Видео",
  rutube: "RuTube",
  kinescope: "Kinescope",
  youtube: "YouTube",
  vimeo: "Vimeo",
  direct: "MP4",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider as VideoProvider] ?? provider;
}

type Media = {
  id: string;
  lesson_id: string;
  kind: string;
  title: string | null;
  url: string;
  provider: string;
  embed_url: string;
  order: number;
  is_public: boolean;
  created_at?: string;
};

export function LessonVideoManager({ lessonId }: { lessonId: string }) {
  const [media, setMedia] = useState<Media[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaErr, setMediaErr] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");

  async function loadMedia() {
    setMediaLoading(true);
    setMediaErr(null);

    const r = await fetch(`/api/admin/lessons/${lessonId}/media`, { method: "GET" });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      setMediaErr(j?.message || j?.error || "Не удалось загрузить видео");
      setMediaLoading(false);
      setMedia([]);
      return;
    }

    setMedia((j.media ?? []) as Media[]);
    setMediaLoading(false);
  }

  useEffect(() => {
    loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function addMedia() {
    setMediaErr(null);
    const url = addUrl.trim();
    if (!url) {
      setMediaErr("Ссылка обязательна");
      return;
    }

    const r = await fetch(`/api/admin/lessons/${lessonId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: addTitle.trim() || null, url }),
    });

    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) {
      setMediaErr(j?.message || j?.error || "Не удалось добавить видео");
      return;
    }

    setAddTitle("");
    setAddUrl("");
    await loadMedia();
  }

  async function patchMedia(
    mediaId: string,
    patch: Partial<{ title: string | null; url: string; order: number; is_public: boolean }>
  ) {
    setMediaErr(null);

    const r = await fetch(`/api/admin/media/${mediaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) {
      setMediaErr(j?.message || j?.error || "Не удалось обновить видео");
      return;
    }

    await loadMedia();
  }

  async function deleteMedia(mediaId: string) {
    setMediaErr(null);

    const r = await fetch(`/api/admin/media/${mediaId}`, { method: "DELETE" });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      setMediaErr(j?.message || j?.error || "Не удалось удалить видео");
      return;
    }

    await loadMedia();
  }

  async function moveUp(item: Media) {
    const idx = media.findIndex((m) => m.id === item.id);
    if (idx <= 0) return;
    await patchMedia(item.id, { order: media[idx - 1].order });
  }

  async function moveDown(item: Media) {
    const idx = media.findIndex((m) => m.id === item.id);
    if (idx === -1 || idx >= media.length - 1) return;
    await patchMedia(item.id, { order: media[idx + 1].order });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Видео урока</CardTitle>
          <CardDescription>
            Вставьте ссылку на VK Видео, RuTube, Kinescope, YouTube или прямую ссылку MP4
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={loadMedia} loading={mediaLoading}>
          Обновить
        </Button>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
          <Input
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            placeholder="Название (необязательно)"
          />
          <Input
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="https://vkvideo.ru/video-... или https://rutube.ru/video/..."
          />
          <Button type="button" onClick={addMedia}>
            Добавить видео
          </Button>
        </div>

        {mediaErr ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive-foreground"
          >
            {mediaErr}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-3">
          {mediaLoading && media.length === 0 ? (
            <p className="text-sm text-muted-foreground">Загрузка видео...</p>
          ) : null}
          {!mediaLoading && media.length === 0 ? (
            <p className="text-sm text-muted-foreground">К этому уроку видео пока не прикреплено</p>
          ) : null}

          {media.map((m) => (
            <div key={m.id} className="rounded-2xl border border-border bg-black/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {m.title || <span className="text-muted-foreground">(без названия)</span>}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>#{m.order}</span>
                    <Badge variant="outline">{providerLabel(m.provider)}</Badge>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  <Button variant="outline" size="icon" onClick={() => moveUp(m)} aria-label="Переместить вверх">
                    <ArrowUp />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => moveDown(m)} aria-label="Переместить вниз">
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => patchMedia(m.id, { is_public: !m.is_public })}
                    aria-label={m.is_public ? "Скрыть" : "Показать"}
                  >
                    {m.is_public ? <Eye /> : <EyeOff />}
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => deleteMedia(m.id)} aria-label="Удалить">
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <p className="mt-2 truncate text-xs text-muted-foreground">{m.url}</p>

              <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-border bg-black">
                <iframe
                  src={m.embed_url}
                  className="h-full w-full border-0"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={m.title ?? "video"}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
