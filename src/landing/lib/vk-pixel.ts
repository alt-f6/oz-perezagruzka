// VK Ads / Top.Mail.Ru retargeting pixel (top-fwz1.mail.ru). Mirrors the
// window-global wrapper pattern in analytics.ts: call sites never touch
// window._tmr directly, and the pixel ID always resolves to the production
// default so this can't silently go dark if the env var is unset, empty, or
// whitespace-only.
const DEFAULT_VK_PIXEL_ID = "3796827";

// _tmr is a push-based event queue the VK snippet installs on window; typing
// it here means future custom events (goals, ecommerce, etc.) dispatched via
// pushVkEvent get checked against this shape instead of falling back to
// `any`.
type VkTmrEvent = {
  id: string;
  type: "pageView" | "reachGoal" | "itemView" | "purchase" | (string & {});
  [key: string]: unknown;
};

declare global {
  interface Window {
    _tmr?: VkTmrEvent[];
  }
}

// Defined separately from `Omit<VkTmrEvent, "id">` -- Omit collapses the
// required `type` property once an index signature is involved, which would
// let callers pass an event with no `type` at all.
type VkTmrEventInput = {
  type: VkTmrEvent["type"];
  [key: string]: unknown;
};

export function getVkPixelId(): string {
  const configured = process.env.NEXT_PUBLIC_VK_PIXEL_ID?.trim();
  return configured ? configured : DEFAULT_VK_PIXEL_ID;
}

// Low-level queue push; call sites should go through analytics.ts (track /
// reachGoal / trackPageview) so goals reach Metrika and VK together. The
// initial pageView hit fires from the loader snippet in
// app/landing/layout.tsx.
export function pushVkEvent(event: VkTmrEventInput): void {
  if (typeof window === "undefined") return;

  window._tmr = window._tmr || [];
  window._tmr.push({ id: getVkPixelId(), ...event });
}
