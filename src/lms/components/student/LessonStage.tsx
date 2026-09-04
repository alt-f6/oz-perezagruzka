"use client";

import { useMemo, useState } from "react";
import { FileText, Video } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { VideoPlayer } from "@/lms/components/student/VideoPlayer";
import { PdfViewer } from "@/lms/components/student/PdfViewer";
import { MediaErrorBoundary } from "@/lms/components/student/MediaErrorBoundary";
import { syncPlaybackPosition } from "../../../../app/lms/student/lessons/[id]/actions";

type MediaRow = { id: string; title: string | null; embed_url: string; provider: string; order: number };
type PdfRow = { id: string; title: string | null; order: number };

type StageAsset =
  | { kind: "video"; id: string; title: string | null; embedUrl: string; provider: string }
  | { kind: "pdf"; id: string; title: string | null };

type Props = {
  lessonId: string;
  studentId: string;
  studentEmail: string | null;
  media: MediaRow[];
  pdfs: PdfRow[];
  initialPosition: number;
};

export function LessonStage({ lessonId, studentId, studentEmail, media, pdfs, initialPosition }: Props) {
  const assets: StageAsset[] = [
    ...media.map((m) => ({
      kind: "video" as const,
      id: m.id,
      title: m.title,
      embedUrl: m.embed_url,
      provider: m.provider,
    })),
    ...pdfs.map((p) => ({ kind: "pdf" as const, id: p.id, title: p.title })),
  ];

  const [activeIndex, setActiveIndex] = useState(0);

  // Computed once per mount so it reflects when this viewing session started,
  // not a live-ticking clock (which would just be visual noise on rerenders).
  const accessLabel = useMemo(
    () => new Date().toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
    []
  );
  const watermarkText = `${studentEmail || `ID:${studentId}`} · Перезагрузка · ${accessLabel}`;

  if (assets.length === 0) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-border bg-card/40 text-sm text-muted-foreground">
        Для этого урока пока нет видео или PDF.
      </div>
    );
  }

  const active = assets[activeIndex];
  const videoCount = media.length;

  return (
    <div className="flex flex-col gap-3">
      {assets.length > 1 ? (
        <div role="tablist" aria-label="Материалы урока" className="flex flex-wrap gap-2">
          {assets.map((asset, i) => {
            const videoNumber = asset.kind === "video" ? media.findIndex((m) => m.id === asset.id) + 1 : 0;
            const label =
              asset.title ||
              (asset.kind === "video"
                ? videoCount > 1
                  ? `Видео ${videoNumber}`
                  : "Видео"
                : "PDF");

            return (
              <button
                key={`${asset.kind}-${asset.id}`}
                type="button"
                role="tab"
                aria-selected={i === activeIndex}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  i === activeIndex
                    ? "border-primary/40 bg-primary/15 text-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {asset.kind === "video" ? (
                  <Video className="size-3.5" aria-hidden="true" />
                ) : (
                  <FileText className="size-3.5" aria-hidden="true" />
                )}
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="transition-[height] duration-300 ease-out">
        <MediaErrorBoundary key={`${active.kind}-${active.id}`}>
          <div className="animate-in fade-in-0 duration-200">
            {active.kind === "video" ? (
              <VideoPlayer
                lessonId={lessonId}
                mediaId={active.id}
                title={active.title}
                embedUrl={active.embedUrl}
                provider={active.provider}
                initialPositionSeconds={activeIndex === 0 ? initialPosition : 0}
              />
            ) : (
              <PdfViewer
                assetId={active.id}
                watermark={watermarkText}
                initialPage={activeIndex === 0 && initialPosition > 1 ? initialPosition : undefined}
                onPageChange={(page) => {
                  void syncPlaybackPosition(lessonId, page);
                }}
              />
            )}
          </div>
        </MediaErrorBoundary>
      </div>
    </div>
  );
}
