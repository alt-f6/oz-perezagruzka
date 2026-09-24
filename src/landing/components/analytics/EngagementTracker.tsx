"use client";

import { useEffect } from "react";
import { track, type EventName } from "@/landing/lib/analytics";

const DEEP_SCROLL_RATIO = 0.75;
const ENGAGED_THRESHOLD_MS = 60_000;
// A second only counts toward engaged_60s if the tab is visible and the user
// interacted within this window -- an idle, forgotten tab doesn't qualify.
const IDLE_AFTER_MS = 30_000;
const TICK_MS = 1_000;

const MESSENGER_HOSTS = new Set([
  "max.ru",
  "wa.me",
  "api.whatsapp.com",
  "web.whatsapp.com",
  "t.me",
  "telegram.me",
  "vk.me",
]);

// Maps a clicked link to its contact goal. Share-intent links (ShareSection's
// t.me/share and WhatsApp `?text=` without a phone) are the user spreading
// the page, not contacting the school, so they don't count.
export function classifyContactHref(href: string): Extract<EventName, "contact_phone_click" | "contact_messenger_click"> | null {
  if (href.toLowerCase().startsWith("tel:")) return "contact_phone_click";

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (!MESSENGER_HOSTS.has(host)) return null;
  if (url.pathname.startsWith("/share")) return null;
  if (host.endsWith("whatsapp.com") && !url.searchParams.has("phone")) return null;

  return "contact_messenger_click";
}

/**
 * Page-wide engagement goals, mounted once in app/landing/layout.tsx:
 * - contact_phone_click / contact_messenger_click via one delegated click
 *   listener, so every tel:/messenger link (header, footer, floating widget,
 *   server-rendered pages) is covered without touching each component;
 * - deep_scroll once past 75% of the document height;
 * - engaged_60s once after 60s of visible, non-idle time.
 */
export function EngagementTracker() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!anchor) return;
      const goal = classifyContactHref(anchor.getAttribute("href") ?? "");
      if (goal) track(goal);
    };

    let scrollFrame = 0;
    const checkScroll = () => {
      scrollFrame = 0;
      const { scrollHeight } = document.documentElement;
      if (scrollHeight > 0 && (window.scrollY + window.innerHeight) / scrollHeight >= DEEP_SCROLL_RATIO) {
        track("deep_scroll", {}, true);
      }
    };
    const handleScroll = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(checkScroll);
    };

    let lastActivity = Date.now();
    let activeMs = 0;
    const markActive = () => {
      lastActivity = Date.now();
    };
    const activityEvents = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const;

    const engagementTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActivity > IDLE_AFTER_MS) return;
      activeMs += TICK_MS;
      if (activeMs >= ENGAGED_THRESHOLD_MS) {
        track("engaged_60s", {}, true);
        window.clearInterval(engagementTimer);
      }
    }, TICK_MS);

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    for (const name of activityEvents) window.addEventListener(name, markActive, { passive: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("scroll", handleScroll);
      for (const name of activityEvents) window.removeEventListener(name, markActive);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      window.clearInterval(engagementTimer);
    };
  }, []);

  return null;
}
