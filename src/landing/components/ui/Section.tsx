import type { ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "white" | "brand-wash";
  paddingOverride?: string;
}

const TONE = {
  // Transparent so the page-level mesh-gradient canvas (set in page.tsx)
  // shows through. An opaque bg-white here would paint over it and flatten
  // the page.
  white: "bg-transparent",
  "brand-wash": "bg-brand-50/60",
} as const;

export default function Section({
  children,
  className = "",
  id,
  tone = "white",
  paddingOverride,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`relative overflow-hidden ${paddingOverride ?? "py-20 md:py-28"} ${TONE[tone]} ${className}`}
    >
      {children}
    </section>
  );
}
