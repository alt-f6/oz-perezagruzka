// Unified telemetry facade for the landing: every goal fans out to both
// Yandex.Metrika (window.ym) and VK Ads (window._tmr) so call sites never
// null-check either global or resolve counter IDs themselves. Both IDs fall
// back to the production counters, so tracking can't silently go dark when
// an env var is missing.
import { getVkPixelId, pushVkEvent } from "@/landing/lib/vk-pixel";

export { getVkPixelId };

const DEFAULT_YM_ID = "113001980";

// Each NEXT_PUBLIC_* var is referenced literally so Next.js can inline it
// into the client bundle; a dynamic `process.env[name]` lookup would not be.
export function getYmId(): string {
  return (
    process.env.NEXT_PUBLIC_YM_ID ||
    process.env.NEXT_PUBLIC_YM_COUNTER_ID ||
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ||
    DEFAULT_YM_ID
  );
}

export type EventName =
  | "lead_submit"
  | "quiz_start"
  | "quiz_step_grade"
  | "quiz_step_subjects"
  | "quiz_step_style"
  | "quiz_step_hobbies"
  | "pricing_view"
  | "contact_phone_click"
  | "contact_messenger_click"
  | "ai_demo_used"
  | "deep_scroll"
  | "engaged_60s";

export type EventParams = Record<string, unknown>;

type YmFunction = {
  (counterId: number, method: "reachGoal", target: string, params?: EventParams): void;
  (counterId: number, method: "hit", url: string): void;
  (counterId: number, method: "getClientID", callback: (clientId: string) => void): void;
};

export function getYm(): YmFunction | undefined {
  if (typeof window === "undefined") return undefined;
  const ym = (window as unknown as { ym?: YmFunction }).ym;
  return typeof ym === "function" ? ym : undefined;
}

// 152-FZ: goal payloads go to third-party ad/analytics systems, so personal
// identifiers must never ride along even if a caller passes them by mistake.
const SENSITIVE_KEYS = new Set(["phone", "email", "name"]);

export function sanitizeParams(params: EventParams): EventParams {
  const clean: EventParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    if (value === undefined) continue;
    clean[key] =
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? sanitizeParams(value as EventParams)
        : value;
  }
  return clean;
}

// Per-page-session dedup for `once` events (pricing_view, deep_scroll, ...).
// In-memory on purpose: a full reload is a new Metrika visit anyway.
const firedOnce = new Set<string>();

export function resetTrackedEvents(): void {
  firedOnce.clear();
}

function dispatchGoal(goal: string, params?: EventParams): void {
  if (typeof window === "undefined") return;

  const ym = getYm();
  if (ym) {
    if (params) ym(Number(getYmId()), "reachGoal", goal, params);
    else ym(Number(getYmId()), "reachGoal", goal);
  }

  pushVkEvent({ type: "reachGoal", goal, ...(params && { params }) });
}

export function track(event: EventName, params: EventParams = {}, once = false): void {
  if (typeof window === "undefined") return;
  if (once) {
    if (firedOnce.has(event)) return;
    firedOnce.add(event);
  }

  const clean = sanitizeParams(params);
  if (process.env.NODE_ENV === "development") {
    console.debug(`[track] ${event}`, clean);
  }
  dispatchGoal(event, Object.keys(clean).length > 0 ? clean : undefined);
}

// Legacy free-form goals (cta_analysis_click, quiz_step_N_completed, ...)
// already configured in Metrika; now mirrored to VK Ads as well.
export function reachGoal(target: string): void {
  dispatchGoal(target);
}

// Fires a manual pageview for a client-side (SPA) route change on both
// counters. Never used for the initial load -- the loader snippets in
// app/landing/layout.tsx send that first hit themselves (see
// AnalyticsTracker, which skips its first render for this reason).
export function trackPageview(url: string): void {
  if (typeof window === "undefined") return;

  getYm()?.(Number(getYmId()), "hit", url);
  pushVkEvent({ type: "pageView", start: Date.now(), url });
}
