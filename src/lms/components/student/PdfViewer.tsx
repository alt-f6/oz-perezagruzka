"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";

import { cn } from "@/shared/lib/utils";

// Unprefixed: the proxy rewrite for the `lms.` host adds the `/lms` segment
// exactly once (same as `/pdf.worker.min.mjs`). A hardcoded `/lms/...` path
// here would get double-prefixed by that rewrite and 404.
const PDF_SANDBOX_SRC = "/pdf-sandbox.html";

// If the embedded renderer hasn't painted a page within this window (blocked
// script, CSP, corrupt asset, etc.), we surface a retry action instead of
// leaving the user staring at an empty frame.
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
  // watchdog that reveals the retry action when embedded rendering fails.
  const [rendered, setRendered] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);
  const [sandboxReady, setSandboxReady] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onPageChangeRef = useRef(onPageChange);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

  const wm = useMemo(() => String(watermark || "").slice(0, 120), [watermark]);

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
  }, [assetId, retryKey]);

  // Deterministic handshake: the sandbox announces SANDBOX_READY once its
  // PDF_LOAD listener is registered, so we only ever post PDF_LOAD after we
  // know it'll be received -- no blind timeout, no dropped first message.
  // The iframe itself never remounts across retries (its `src` is static),
  // so this only needs to run once for the lifetime of the component.
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data || {};
      if (data.type === "SANDBOX_READY") {
        setSandboxReady(true);
        return;
      }
      if (data.type !== "PDF_PAGE") return;
      // First painted page proves the embedded renderer is alive.
      setRendered(true);
      setRenderFailed(false);
      onPageChangeRef.current?.(Number(data.page));
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!signedUrl || !sandboxReady) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      iframe.contentWindow?.postMessage(
        { type: "PDF_LOAD", signedUrl, watermark: wm, scale, initialPage },
        "*"
      );
    } catch {}
    // initialPage is only meant to apply to the initial load of this asset,
    // not every time it changes, so it's intentionally excluded below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedUrl, sandboxReady, wm, scale]);

  // Watchdog: once we've handed the sandbox a URL, give it a bounded window to
  // paint. If nothing renders (blocked worker, CSP, corrupt file), reveal the
  // retry action so the user is never stranded on a blank frame.
  useEffect(() => {
    if (!signedUrl || rendered) return;
    const t = setTimeout(() => {
      if (!rendered) setRenderFailed(true);
    }, RENDER_WATCHDOG_MS);
    return () => clearTimeout(t);
  }, [signedUrl, rendered]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "p" || key === "s") {
        e.preventDefault();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const retryAction = (
    <button
      type="button"
      onClick={() => setRetryKey((k) => k + 1)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
    >
      <RotateCw className="size-4" aria-hidden="true" />
      Обновить
    </button>
  );

  return (
    <div className={cn("space-y-2 print:hidden", className)}>
      <div
        className="relative overflow-hidden rounded-2xl border border-border bg-black/20 select-none"
        style={{ height }}
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {err ? (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-destructive-foreground"
          >
            <p>Не удалось загрузить документ. Попробуйте обновить.</p>
            {retryAction}
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
            {retryAction}
          </div>
        ) : null}

        <iframe
          ref={iframeRef}
          src={PDF_SANDBOX_SRC}
          className={cn("h-full w-full border-0 bg-transparent", signedUrl && !err ? "block" : "hidden")}
          title="PDF"
        />
      </div>
    </div>
  );
}
