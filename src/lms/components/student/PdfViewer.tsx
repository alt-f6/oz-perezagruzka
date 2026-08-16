"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";

type Props = {
  assetId: string;
  watermark: string;
  height?: number;
  scale?: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  className?: string;
};

export function PdfViewer({
  assetId,
  watermark,
  height = 640,
  scale = 1.35,
  initialPage,
  onPageChange,
  className,
}: Props) {
  const [err, setErr] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

  const wm = useMemo(() => String(watermark || "").slice(0, 80), [watermark]);

  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;
    el.setAttribute("sandbox", "allow-scripts allow-same-origin");
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      setErr(null);
      setSignedUrl(null);

      try {
        const r = await fetch(`/api/student/pdf-url?assetId=${assetId}`, {
          cache: "no-store",
          credentials: "include",
        });
        const j = await r.json().catch(() => null);

        if (!r.ok || !j?.ok || !j?.url) {
          throw new Error(j?.error || `pdf_url_failed_${r.status}`);
        }

        if (!alive) return;
        setSignedUrl(j.url);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || e));
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [assetId]);

  useEffect(() => {
    if (!signedUrl) return;

    function post() {
      const iframe = iframeRef.current;
      if (!iframe) return;

      try {
        iframe.contentWindow?.postMessage(
          { type: "PDF_LOAD", signedUrl, watermark: wm, scale, initialPage },
          "*"
        );
      } catch {}
    }

    const t = setTimeout(post, 80);
    return () => clearTimeout(t);
    // initialPage is only meant to apply to the initial load of this asset,
    // not every time it changes, so it's intentionally excluded below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedUrl, wm, scale]);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data || {};
      if (data.type !== "PDF_PAGE") return;
      onPageChangeRef.current?.(Number(data.page));
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-black/20",
        className
      )}
      style={{ height }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {err ? (
        <p
          role="alert"
          className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-destructive-foreground"
        >
          {err}
        </p>
      ) : null}

      {!err && !signedUrl ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Загрузка PDF…
        </div>
      ) : null}

      <iframe
        ref={iframeRef}
        src="/pdf-sandbox.html"
        className={cn("h-full w-full border-0 bg-transparent", signedUrl ? "block" : "hidden")}
        title="PDF"
      />
    </div>
  );
}
