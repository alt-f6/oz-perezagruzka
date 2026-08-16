"use client";

import { useEffect, useRef, useState } from "react";

import { setLessonCompletion, syncPlaybackPosition } from "../../../../app/lms/student/lessons/[id]/actions";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<any> | null = null;

function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no_window"));
  if (window.YT?.Player) return Promise.resolve(window.YT);

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };

      const existing = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.onerror = () => reject(new Error("youtube_api_load_failed"));
        document.head.appendChild(script);
      }
    });
  }

  return youtubeApiPromise;
}

function extractYouTubeId(embedUrl: string): string | null {
  const m = embedUrl.match(/\/embed\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

const SYNC_INTERVAL_MS = 15_000;

type Props = {
  lessonId: string;
  mediaId: string;
  title: string | null;
  embedUrl: string;
  provider: string;
  initialPositionSeconds?: number;
};

export function VideoPlayer({
  lessonId,
  mediaId,
  title,
  embedUrl,
  provider,
  initialPositionSeconds = 0,
}: Props) {
  const containerId = `yt-player-${mediaId}`;
  const playerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  const isYouTube = provider === "youtube";
  const videoId = isYouTube ? extractYouTubeId(embedUrl) : null;

  useEffect(() => {
    if (!isYouTube || !videoId) return;

    let destroyed = false;
    let syncTimer: ReturnType<typeof setInterval> | null = null;

    function reportPosition() {
      try {
        const seconds = playerRef.current?.getCurrentTime?.();
        if (typeof seconds === "number") {
          void syncPlaybackPosition(lessonId, seconds);
        }
      } catch {}
    }

    loadYouTubeApi()
      .then((YT) => {
        if (destroyed) return;

        playerRef.current = new YT.Player(containerId, {
          videoId,
          playerVars: { start: Math.max(0, Math.floor(initialPositionSeconds)) },
          events: {
            onStateChange: (ev: any) => {
              if (ev.data === YT.PlayerState.ENDED) {
                void setLessonCompletion(lessonId, true);
              }
            },
            onError: () => {
              if (!destroyed) setError("Не удалось загрузить видео");
            },
          },
        });

        syncTimer = setInterval(reportPosition, SYNC_INTERVAL_MS);
      })
      .catch(() => {
        if (!destroyed) setError("Не удалось загрузить видеоплеер");
      });

    return () => {
      destroyed = true;
      if (syncTimer) clearInterval(syncTimer);
      reportPosition();

      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isYouTube, videoId, containerId, lessonId]);

  if (isYouTube) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
        <div id={containerId} className="h-full w-full" />

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
        <iframe
          src={embedUrl}
          className="h-full w-full border-0"
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={title ?? "video"}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Прогресс просмотра не отслеживается для этого источника.
      </p>
    </div>
  );
}
