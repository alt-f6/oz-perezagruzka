"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";

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
      setMediaErr(j?.message || j?.error || "Failed to load media");
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
      setMediaErr("URL is required");
      return;
    }

    const r = await fetch(`/api/admin/lessons/${lessonId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: addTitle.trim() || null, url }),
    });

    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) {
      setMediaErr(j?.message || j?.error || "Failed to add video");
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
      setMediaErr(j?.message || j?.error || "Failed to update video");
      return;
    }

    await loadMedia();
  }

  async function deleteMedia(mediaId: string) {
    setMediaErr(null);

    const r = await fetch(`/api/admin/media/${mediaId}`, { method: "DELETE" });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      setMediaErr(j?.message || j?.error || "Failed to delete video");
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
          <CardTitle>Lesson Video</CardTitle>
          <CardDescription>Add YouTube or Vimeo links.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={loadMedia} loading={mediaLoading}>
          Refresh
        </Button>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
          <Input
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            placeholder="Title (optional)"
          />
          <Input
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="https://youtu.be/... or https://vimeo.com/..."
          />
          <Button type="button" onClick={addMedia}>
            Add
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
            <p className="text-sm text-muted-foreground">Loading videos...</p>
          ) : null}
          {!mediaLoading && media.length === 0 ? (
            <p className="text-sm text-muted-foreground">No videos yet</p>
          ) : null}

          {media.map((m) => (
            <div key={m.id} className="rounded-2xl border border-border bg-black/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{m.title || <span className="text-muted-foreground">(untitled)</span>}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    #{m.order} · {m.provider}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  <Button variant="outline" size="icon" onClick={() => moveUp(m)} aria-label="Move up">
                    <ArrowUp />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => moveDown(m)} aria-label="Move down">
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => patchMedia(m.id, { is_public: !m.is_public })}
                    aria-label={m.is_public ? "Hide" : "Show"}
                  >
                    {m.is_public ? <Eye /> : <EyeOff />}
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => deleteMedia(m.id)} aria-label="Delete">
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <p className="mt-2 truncate text-xs text-muted-foreground">{m.url}</p>

              <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-border bg-black">
                <iframe
                  src={m.embed_url}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
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
