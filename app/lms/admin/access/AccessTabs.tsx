import Link from "next/link";

import { cn } from "@/shared/lib/utils";

// Shared by /admin/access (course enrollment) and /admin/assignments
// (per-lesson overrides) so both read as one "Доступ" section.
export function AccessTabs({ active }: { active: "courses" | "lessons" }) {
  const tabs = [
    { key: "courses", href: "/admin/access", label: "По курсам" },
    { key: "lessons", href: "/admin/assignments", label: "Отдельные уроки" },
  ] as const;

  return (
    <div role="tablist" aria-label="Способ выдачи доступа" className="mb-5 flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={active === t.key}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            active === t.key
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
