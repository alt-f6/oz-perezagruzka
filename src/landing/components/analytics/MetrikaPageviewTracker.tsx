"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageview } from "@/landing/lib/analytics";

/**
 * Fires a Yandex Metrika "hit" on every SPA route change. Skips the very
 * first commit on purpose: the Metrika snippet's own `ym(id, "init", ...)`
 * call (in app/landing/layout.tsx) already sends the initial pageview, so
 * firing here too would double-count it. Tracks the previously-recorded URL
 * (rather than a first-render boolean) so this is safe under React Strict
 * Mode's development-only double-invocation of effects on mount: the
 * synthetic second invocation runs with the same pathname/searchParams as
 * the first, so it's correctly treated as "unchanged" and skipped, while a
 * genuine navigation (a different URL) still fires exactly once.
 */
export function MetrikaPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousUrl = useRef<string | null>(null);

  useEffect(() => {
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;

    if (previousUrl.current !== null && previousUrl.current !== url) {
      trackPageview(url);
    }
    previousUrl.current = url;
  }, [pathname, searchParams]);

  return null;
}
