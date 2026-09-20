"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageview } from "@/landing/lib/analytics";

/**
 * Fires a Yandex Metrika "hit" on every SPA route change. Skips the very
 * first render on purpose: the Metrika snippet's own `ym(id, "init", ...)`
 * call (in app/landing/layout.tsx) already sends the initial pageview, so
 * firing here too on mount would double-count it.
 */
export function MetrikaPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const query = searchParams.toString();
    trackPageview(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  return null;
}
