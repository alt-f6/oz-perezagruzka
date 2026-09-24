"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageview } from "@/landing/lib/analytics";
import { captureAttribution } from "@/landing/lib/attribution";

/**
 * Fires a Metrika "hit" and a VK Ads "pageView" on every SPA route change,
 * and refreshes first/last-touch attribution on every URL (including the
 * initial one).
 *
 * The pageview skips the very first commit on purpose: the loader snippets
 * in app/landing/layout.tsx already send the initial hit, so firing here too
 * would double-count it. The first-render guard is the previously-recorded
 * URL (null until the first effect) rather than a boolean, so it is safe
 * under React Strict Mode's development-only double-invocation of effects:
 * the synthetic second run sees the same URL and is skipped, while a genuine
 * navigation (a different URL) still fires exactly once.
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;

    captureAttribution();

    const isFirstRender = previousUrl.current === null;
    if (!isFirstRender && previousUrl.current !== url) {
      trackPageview(`${window.location.origin}${url}`);
    }
    previousUrl.current = url;
  }, [pathname, searchParams]);

  return null;
}
