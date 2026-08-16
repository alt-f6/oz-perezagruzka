export type CookieConsentValue = "granted" | "denied";

const STORAGE_KEY = "perezagruzkahm:cookie-consent";
const COOKIE_NAME = "pzhm_cookie_consent";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 12 months, matching the "функциональные" cookie retention stated in /privacy §6.
const CHANGE_EVENT = "perezagruzkahm:cookie-consent-changed";

function isConsentValue(value: string | null): value is CookieConsentValue {
  return value === "granted" || value === "denied";
}

function writeCookie(value: CookieConsentValue): void {
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

// Reads the persisted consent choice, or `null` if the visitor hasn't
// answered yet. Checks localStorage first (works even if cookies are
// disabled) — client-only, call from useEffect/useState initializers.
export function getCookieConsent(): CookieConsentValue | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isConsentValue(stored)) return stored;
  } catch {
    // localStorage unavailable (privacy mode / disabled storage) — fall through.
  }
  return null;
}

// Persists the visitor's choice to both localStorage and a first-party
// cookie, then broadcasts a change event so any mounted listener (e.g. a
// future analytics-script loader gated on consent) can react immediately
// without polling.
export function setCookieConsent(value: CookieConsentValue): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore write failures — the cookie write below still gives the choice
    // a chance to persist, and the banner will simply reappear next visit
    // if both fail.
  }
  try {
    writeCookie(value);
  } catch {
    // document.cookie can throw in some restricted iframe contexts.
  }
  window.dispatchEvent(new CustomEvent<CookieConsentValue>(CHANGE_EVENT, { detail: value }));
}

// Subscribes to consent changes. Returns an unsubscribe function. Intended
// integration point for gating non-essential scripts (analytics, etc.) on
// consent — call `getCookieConsent()` once for the current value, then
// subscribe here for subsequent changes.
export function onCookieConsentChange(handler: (value: CookieConsentValue) => void): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<CookieConsentValue>).detail);
  };
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
