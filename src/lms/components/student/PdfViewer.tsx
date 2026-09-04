"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";

// The pdf.js sandbox is a static asset under `public/lms/`, which Next.js
// serves at `/lms/pdf-sandbox.html` (there is no basePath/rewrite). A bare
// `/pdf-sandbox.html` 404s, the iframe never wires up its message listener,
// and the viewer renders blank — the regression this path fixes.
const PDF_SANDBOX_SRC = "/lms/pdf-sandbox.html";

// If the embedded renderer hasn't painted a page within this window (sandbox
// 404, blocked script, CSP, etc.), we surface the fallback actions prominently
// instead of leaving the user staring at an empty frame.
const RENDER_WATCHDOG_MS = 6000;

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
  // Flips true once the sandbox reports its first painted page; drives the
  // watchdog that reveals the fallback banner when embedded rendering fails.
  const [rendered, setRendered] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);
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
      setRendered(false);
      setRenderFailed(false);

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
      // First painted page proves the embedded renderer is alive.
      setRendered(true);
      setRenderFailed(false);
      onPageChangeRef.current?.(Number(data.page));
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Watchdog: once we've handed the sandbox a URL, give it a bounded window to
  // paint. If nothing renders (404'd sandbox, blocked CDN worker, CSP), reveal
  // the fallback actions so the user is never stranded on a blank frame.
  useEffect(() => {
    if (!signedUrl || rendered) return;
    const t = setTimeout(() => {
      if (!rendered) setRenderFailed(true);
    }, RENDER_WATCHDOG_MS);
    return () => clearTimeout(t);
  }, [signedUrl, rendered]);

  const fallbackActions =
    signedUrl != null ? (
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Открыть в новой вкладке
        </a>
        <a
          href={signedUrl}
          download
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <Download className="size-4" aria-hidden="true" />
          Скачать PDF
        </a>
      </div>
    ) : null;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className="relative overflow-hidden rounded-2xl border border-border bg-black/20"
        style={{ height }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {err ? (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-destructive-foreground"
          >
            <p>Не удалось загрузить PDF: {err}</p>
            {fallbackActions}
          </div>
        ) : null}

        {!err && !signedUrl ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Загрузка PDF…
          </div>
        ) : null}

        {!err && renderFailed && !rendered ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 p-4 text-center text-sm">
            <p className="text-muted-foreground">
              Встроенный просмотрщик не смог отобразить документ.
            </p>
            {fallbackActions}
          </div>
        ) : null}

        <iframe
          ref={iframeRef}
          src={PDF_SANDBOX_SRC}
          className={cn("h-full w-full border-0 bg-transparent", signedUrl && !err ? "block" : "hidden")}
          title="PDF"
        />
      </div>

      {/* Always-available escape hatch: even when the embedded renderer works,
          browsers/policies can still block it, so the direct actions stay put. */}
      {!err && signedUrl ? (
        <div className="flex items-center justify-end">{fallbackActions}</div>
      ) : null}
    </div>
  );
}
