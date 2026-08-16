interface AtmosphereProps {
  variant?: "brand" | "accent" | "mixed";
  intensity?: "soft" | "premium";
}

const INTENSITY = {
  soft: {
    brand: "h-72 w-72 bg-brand-500/10 blur-3xl",
    accent: "h-64 w-64 bg-accent-500/10 blur-3xl",
  },
  premium: {
    brand: "h-[26rem] w-[26rem] bg-brand-300/40 blur-[100px]",
    accent: "h-96 w-96 bg-accent-300/35 blur-[100px]",
  },
} as const;

/**
 * Decorative background layer for "anchor" sections (Hero, Solution, Pricing).
 * Pure CSS, no framer-motion, no client JS, nothing to hydrate. Absolutely
 * positioned so it never affects layout or triggers CLS; the blob-float
 * keyframes are gated behind `motion-safe:` so they simply don't run for
 * prefers-reduced-motion users (the shapes still render, just static).
 * Parent section must be `relative overflow-hidden`, and this must be the
 * FIRST child there. It relies on plain DOM order (not a negative z-index)
 * to stay behind the section's content. A negative z-index here used to
 * render this fully invisible: combined with the parent's `overflow-hidden`,
 * Chromium's compositor was placing this layer behind the section's own
 * background paint instead of just behind its sibling content, so the whole
 * decorative layer never showed no matter how strong its colors were.
 */
export default function Atmosphere({ variant = "mixed", intensity = "soft" }: AtmosphereProps) {
  const scale = INTENSITY[intensity];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {(variant === "brand" || variant === "mixed") && (
        <div
          className={`motion-safe:animate-blob-float absolute -left-24 -top-24 rounded-full [will-change:transform] [transform:translateZ(0)] ${scale.brand}`}
        />
      )}
      {(variant === "accent" || variant === "mixed") && (
        <div
          className={`motion-safe:animate-blob-float-slow absolute -right-16 bottom-0 rounded-full [will-change:transform] [transform:translateZ(0)] ${scale.accent}`}
        />
      )}
    </div>
  );
}
