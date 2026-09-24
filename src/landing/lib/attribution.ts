// First/last-touch marketing attribution persisted in localStorage, plus the
// Metrika ClientID lookup. Everything here is SSR-safe (no-ops on the server)
// and swallows storage errors (Safari private mode, blocked site data), since
// attribution must never break the lead form it feeds.
import { getYm, getYmId } from "@/landing/lib/analytics";

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const CLICK_ID_KEYS = ["click_id", "yclid", "gclid", "fbclid"] as const;

export const ATTR_FIRST_KEY = "attr_first";
export const ATTR_LAST_KEY = "attr_last";

const MAX_VALUE_LENGTH = 500;
const YM_CLIENT_ID_TIMEOUT_MS = 300;

export type Touch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  click_id?: string;
  referrer?: string;
  landing_path?: string;
  ts: string;
};

export type Attribution = {
  attr_first: Touch | null;
  attr_last: Touch | null;
};

function clip(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, MAX_VALUE_LENGTH) : undefined;
}

// True when the URL carries any campaign marker -- the only case in which
// the last touch gets overwritten, so an internal reload or a direct revisit
// never erases the campaign that actually brought the user in.
export function hasCampaignParams(search: string): boolean {
  const params = new URLSearchParams(search);
  return [...UTM_KEYS, ...CLICK_ID_KEYS].some((key) => clip(params.get(key)) !== undefined);
}

export function parseTouch(
  search: string,
  referrer: string,
  landingPath: string,
  now: Date = new Date(),
): Touch {
  const params = new URLSearchParams(search);
  const touch: Touch = { ts: now.toISOString() };

  for (const key of UTM_KEYS) {
    const value = clip(params.get(key));
    if (value) touch[key] = value;
  }
  const clickId = CLICK_ID_KEYS.map((key) => clip(params.get(key))).find(Boolean);
  if (clickId) touch.click_id = clickId;

  const ref = clip(referrer);
  if (ref) touch.referrer = ref;
  const path = clip(landingPath);
  if (path) touch.landing_path = path;

  return touch;
}

function readTouch(key: string): Touch | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Touch) : null;
  } catch {
    return null;
  }
}

function writeTouch(key: string, touch: Touch): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(touch));
  } catch {
    // Storage unavailable -- attribution is best-effort.
  }
}

// Called on the initial load and on every SPA navigation. attr_first is
// write-once (the very first visit, campaign or not); attr_last is rewritten
// whenever the current URL carries campaign params.
export function captureAttribution(): void {
  if (typeof window === "undefined") return;

  const { search, pathname } = window.location;
  const touch = parseTouch(search, document.referrer, pathname);

  if (!readTouch(ATTR_FIRST_KEY)) writeTouch(ATTR_FIRST_KEY, touch);
  if (hasCampaignParams(search)) writeTouch(ATTR_LAST_KEY, touch);
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return { attr_first: null, attr_last: null };
  return { attr_first: readTouch(ATTR_FIRST_KEY), attr_last: readTouch(ATTR_LAST_KEY) };
}

// Resolves Metrika's ClientID for offline-conversion matching, or null when
// the counter is blocked/slow -- never holds up a form submit longer than
// YM_CLIENT_ID_TIMEOUT_MS.
export function getYmClientId(timeoutMs: number = YM_CLIENT_ID_TIMEOUT_MS): Promise<string | null> {
  const ym = getYm();
  if (!ym) return Promise.resolve(null);

  const lookup = new Promise<string | null>((resolve) => {
    try {
      ym(Number(getYmId()), "getClientID", (clientId) => resolve(clientId ? String(clientId) : null));
    } catch {
      resolve(null);
    }
  });
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

  return Promise.race([lookup, timeout]);
}
