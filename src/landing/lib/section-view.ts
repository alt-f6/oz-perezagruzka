"use client";

import { useEffect, type RefObject } from "react";
import { track, type EventName } from "@/landing/lib/analytics";

const VISIBLE_RATIO = 0.5;

// A plain `intersectionRatio >= 0.5` can never be satisfied by a section
// taller than twice the viewport (e.g. #pricing stacks to ~1400px on a ~700px
// phone screen, capping its ratio near 0.5 or below), so a section also
// counts as seen once it fills at least half of the viewport.
export function isMeaningfullyVisible(
  entry: Pick<IntersectionObserverEntry, "isIntersecting" | "intersectionRatio" | "intersectionRect">,
  viewportHeight: number,
): boolean {
  if (entry.intersectionRatio >= VISIBLE_RATIO) return true;
  return entry.isIntersecting && entry.intersectionRect.height >= viewportHeight * VISIBLE_RATIO;
}

const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

// Fires `event` once per page session after the element has stayed
// meaningfully visible for `dwellMs` without interruption; scrolling it out
// of view cancels the pending timer.
export function useSectionViewGoal(ref: RefObject<Element | null>, event: EventName, dwellMs = 2000): void {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (!entry.isIntersecting || !isMeaningfullyVisible(entry, window.innerHeight)) {
          clear();
          return;
        }
        if (timer !== null) return;
        timer = setTimeout(() => {
          timer = null;
          track(event, {}, true);
          observer.disconnect();
        }, dwellMs);
      },
      { threshold: THRESHOLDS },
    );

    observer.observe(element);
    return () => {
      clear();
      observer.disconnect();
    };
  }, [ref, event, dwellMs]);
}
