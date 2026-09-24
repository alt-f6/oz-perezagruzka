import type { ReactNode } from "react";
import { FileText, Headphones, PlayCircle, Presentation, Type, type LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { EXAM_TYPE_LABELS, isExamType } from "@/shared/lib/education";
import type { LessonContentKind } from "@/lms/lib/lesson-readiness";

// Small, dependency-free building blocks for the LMS admin surfaces.
// Visual language: 1px borders, flat surfaces, color only for state/focus.

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-lg border border-border bg-card", className)}>{children}</section>;
}

export function PanelHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {action}
    </div>
  );
}

export function KpiCard({
  label,
  icon: Icon,
  value,
  caption,
  footer,
  accent = false,
}: {
  label: string;
  icon: LucideIcon;
  value: ReactNode;
  caption?: ReactNode;
  footer?: ReactNode;
  accent?: boolean;
}) {
  return (
    <Panel className={cn("relative flex flex-col gap-3 overflow-hidden p-4", accent && "border-primary/40")}>
      {accent ? <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-primary" /> : null}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground/70" aria-hidden="true" />
      </div>
      <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      {caption ? <p className="text-sm text-muted-foreground">{caption}</p> : null}
      {footer ? <div className="mt-auto">{footer}</div> : null}
    </Panel>
  );
}

/** Thin two-tone progress bar (e.g. published share). */
export function RatioBar({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatusPill({ published }: { published: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        published ? "border-success/25 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", published ? "bg-success" : "bg-muted-foreground/60")}
      />
      {published ? "Опубликован" : "Черновик"}
    </span>
  );
}

export function ExamPill({ examType }: { examType: string | null }) {
  if (!isExamType(examType)) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        examType === "EGE" ? "bg-primary text-primary-foreground" : "border border-primary/60 text-primary-2",
      )}
    >
      {EXAM_TYPE_LABELS[examType]}
    </span>
  );
}

export function TagPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "sky" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "border border-border text-muted-foreground",
        tone === "sky" && "bg-sky/10 text-sky",
        tone === "warning" && "bg-warning/10 text-warning",
      )}
    >
      {children}
    </span>
  );
}

const KIND_META: Record<LessonContentKind, { label: string; icon: LucideIcon }> = {
  video: { label: "Видео", icon: PlayCircle },
  slides: { label: "Слайды", icon: Presentation },
  pdf: { label: "PDF", icon: FileText },
  audio: { label: "Аудио", icon: Headphones },
  text: { label: "Текст", icon: Type },
};

export function ContentChips({ kinds }: { kinds: LessonContentKind[] }) {
  if (kinds.length === 0) {
    return <TagPill tone="warning">Нет материалов</TagPill>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {kinds.map((k) => {
        const { label, icon: Icon } = KIND_META[k];
        return (
          <span
            key={k}
            title={label}
            className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground"
          >
            <Icon className="size-3" aria-hidden="true" />
            <span>{label}</span>
          </span>
        );
      })}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Panel className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </Panel>
  );
}
