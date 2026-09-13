"use client";

import { useEffect, useRef, useState } from "react";

const SYNC_INTERVAL_MS = 15_000;
const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

type Props = {
  // Accepted for interface consistency with how LessonStage calls this
  // component (mirroring other stage components that use lessonId for
  // syncPlaybackPosition) -- not used in this component's own signed-URL
  // fetch, which only needs assetId.
  lessonId: string;
  assetId: string;
  title: string | null;
  initialPositionSeconds: number;
  onPositionChange: (seconds: number) => void;
};

// Reuses the existing student signed-URL endpoint at /api/student/pdf-url,
// which was generalized (alongside the admin presign route in an earlier
// task) to sign both "pdf" and "audio" LessonAsset kinds by their storageKey
// -- there is no separate per-lesson asset-signing endpoint.
export function AudioPlayer({ assetId, title, initialPositionSeconds, onPositionChange }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    let alive = true;
    fetch(`/api/student/pdf-url?assetId=${assetId}`, { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (alive && data?.ok && data?.url) setUrl(data.url);
      });
    return () => {
      alive = false;
    };
  }, [assetId]);

  // Seek to the saved resume position exactly once, as soon as the signed
  // URL is available. This must not re-run on speed changes or parent
  // re-renders (onPositionChange is an inline arrow function from the
  // parent that changes identity every render), or playback jumps back to
  // the resume position every time.
  const hasSeekedRef = useRef(false);
  useEffect(() => {
    hasSeekedRef.current = false;
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url || hasSeekedRef.current) return;
    if (initialPositionSeconds > 0) audio.currentTime = initialPositionSeconds;
    hasSeekedRef.current = true;
  }, [url, initialPositionSeconds]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    audio.playbackRate = rate;
  }, [url, rate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;

    const interval = setInterval(() => {
      if (!audio.paused) onPositionChange(Math.floor(audio.currentTime));
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [url, onPositionChange]);

  function skip(deltaSeconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime + deltaSeconds);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-4">
      {title ? <p className="text-sm font-semibold">{title}</p> : null}
      <audio ref={audioRef} src={url ?? undefined} controls preload="metadata" className="w-full" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => skip(-15)}
          className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
        >
          -15с
        </button>
        <button
          type="button"
          onClick={() => skip(15)}
          className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
        >
          +15с
        </button>
        <label htmlFor="audio-speed" className="ml-auto text-xs text-muted-foreground">
          Скорость
        </label>
        <select
          id="audio-speed"
          aria-label="Скорость воспроизведения"
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="rounded-md border border-border bg-transparent px-2 py-1 text-xs"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
