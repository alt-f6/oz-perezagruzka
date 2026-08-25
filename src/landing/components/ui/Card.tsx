import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  tint?: "white" | "brand" | "glass" | "glass-active" | "premium";
  padding?: "none" | "sm" | "md" | "lg";
  rounded?: "2xl" | "3xl";
}

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-6 md:p-8",
} as const;

const ROUNDED = {
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
} as const;

// "glass" / "glass-active" / "premium" bundle the frosted-panel looks repeated
// across FAQ/PainPoints/HowItWorks/SocialProof/etc so they live in one place
// instead of copy-pasted Tailwind strings per section.
const TINT = {
  white: "bg-white border-ink-100 shadow-sm shadow-ink-900/5",
  brand: "bg-brand-50/60 border-brand-100 shadow-sm shadow-ink-900/5",
  glass: "border-white/40 bg-white/70 shadow-card backdrop-blur-xl",
  "glass-active": "border-brand-200 bg-brand-50/90 shadow-xl shadow-brand-900/10 backdrop-blur-xl",
  premium: "border-brand-100/80 bg-white/80 shadow-xl shadow-ink-900/5 backdrop-blur-md",
} as const;

export default function Card({
  children,
  className = "",
  tint = "white",
  padding = "lg",
  rounded = "2xl",
}: CardProps) {
  return (
    <div className={`border ${ROUNDED[rounded]} ${TINT[tint]} ${PADDING[padding]} ${className}`}>
      {children}
    </div>
  );
}
