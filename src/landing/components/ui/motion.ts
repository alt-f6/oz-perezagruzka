import type { Variants } from "framer-motion";

// The two entrance-animation shapes every section on the landing page
// reimplemented locally (opacity/y fade-in-up + a staggered container),
// centralized here so they can't drift out of sync with each other.

export function fadeInUp(prefersReducedMotion: boolean | null, distance = 20): Variants {
  return prefersReducedMotion
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : { hidden: { opacity: 0, y: distance }, show: { opacity: 1, y: 0 } };
}

export function staggerContainer(staggerChildren = 0.12): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren } },
  };
}

export function floatY(prefersReducedMotion: boolean | null, duration: number, distance = 10) {
  return {
    animate: prefersReducedMotion ? undefined : { y: [0, -distance, 0] },
    transition: { duration, repeat: Infinity, ease: "easeInOut" as const },
  };
}
