"use client";

import { useEffect, useRef, useState } from "react";

import { setLessonCompletion, syncPlaybackPosition } from "../../../../app/lms/student/lessons/[id]/actions";
import Hls from "hls.js";

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
  const lastDirectSyncRef = useRef(0);
  const [error, setError] = useState<string | null>(null);

  const isYouTube = provider === "youtube";
  const isDirect = provider === "direct";
  const isGenericEmbed = !isYouTube && !isDirect;
  const videoId = isYouTube ? extractYouTubeId(embedUrl) : null;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isHls = isDirect && /\.m3u8(\?|#|$)/i.test(embedUrl);

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

  useEffect(() => {
    if (!isGenericEmbed) return;

    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      void syncPlaybackPosition(lessonId, initialPositionSeconds + elapsed);
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isGenericEmbed, lessonId, initialPositionSeconds]);

  useEffect(() => {
    if (!isHls) return;

    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = embedUrl;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(embedUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setError("Не удалось загрузить видео");
      });

      return () => {
        hls.destroy();
      };
    }

    setError("Ваш браузер не поддерживает воспроизведение этого видео");
  }, [isHls, embedUrl]);

  function handleDirectTimeUpdate(e: React.SyntheticEvent<HTMLVideoElement>) {
    const now = Date.now();
    if (now - lastDirectSyncRef.current < SYNC_INTERVAL_MS) return;
    lastDirectSyncRef.current = now;
    void syncPlaybackPosition(lessonId, e.currentTarget.currentTime);
  }

  function handleDirectLoadedMetadata(e: React.SyntheticEvent<HTMLVideoElement>) {
    if (initialPositionSeconds > 0) {
      e.currentTarget.currentTime = initialPositionSeconds;
    }
  }

  function handleDirectError() {
    setError("Не удалось загрузить видео");
  }

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

  if (isDirect) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
        <video
          ref={videoRef}
          controls
          playsInline
          className="h-full w-full"
          src={isHls ? undefined : embedUrl}
          onTimeUpdate={handleDirectTimeUpdate}
          onLoadedMetadata={handleDirectLoadedMetadata}
          onEnded={() => void setLessonCompletion(lessonId, true)}
          onError={handleDirectError}
        >
          {title}
        </video>

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
      <iframe
        src={embedUrl}
        className="h-full w-full border-0"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        title={title ?? "video"}
      />
    </div>
  );
}
