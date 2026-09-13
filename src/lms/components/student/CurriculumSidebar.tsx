"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, Circle, FileText, Headphones, Loader2, Lock, Presentation, Video } from "lucide-react";

import { cn } from "@/shared/lib/utils";

export type CurriculumLesson = {
  id: string;
  title: string;
  order: number;
  assigned: boolean;
  completedAt: string | null;
  format: "video" | "audio" | "presentation" | "text";
};

export type CurriculumModule = {
  id: string;
  title: string;
  locked: boolean;
  lockReason: "drip" | "fixed_date" | "unpublished" | null;
  unlocksAt: string | null;
  lessons: CurriculumLesson[];
};

type Props = {
  modules: CurriculumModule[];
  currentLessonId: string;
  onNavigate?: () => void;
};

const FORMAT_ICON: Record<CurriculumLesson["format"], typeof Video> = {
  video: Video,
  audio: Headphones,
  presentation: Presentation,
  text: FileText,
};

function formatUnlockDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CurriculumSidebar({ modules, currentLessonId, onNavigate }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Only the module containing the current lesson starts expanded; all other
  // modules start collapsed so real multi-month courses don't open with every
  // module expanded at once.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(modules.filter((m) => m.lessons.some((l) => l.id === currentLessonId)).map((m) => m.id))
  );

  function toggle(moduleId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  function goTo(lessonId: string) {
    onNavigate?.();
    if (lessonId === currentLessonId) return;
    setPendingId(lessonId);
    startTransition(() => router.push(`/student/lessons/${lessonId}`));
  }

  return (
    <nav aria-label="Учебный план" className="flex flex-col gap-2">
      {modules.map((module) => {
        const isOpen = expanded.has(module.id);
        const completedCount = module.lessons.filter((l) => l.completedAt).length;
        const unlockLabel =
          module.lockReason === "drip" || module.lockReason === "fixed_date"
            ? `Доступно с ${formatUnlockDate(module.unlocksAt) ?? "..."}`
            : module.lockReason === "unpublished"
              ? "Модуль ещё не опубликован"
              : null;

        return (
          <div key={module.id} className="rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => toggle(module.id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold"
              title={unlockLabel ?? undefined}
            >
              <span className="flex items-center gap-2 truncate">
                {module.locked ? <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
                {module.title}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground">
                {completedCount}/{module.lessons.length}
                <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
              </span>
            </button>

            {unlockLabel ? <p className="px-3 pb-2 text-xs text-muted-foreground">{unlockLabel}</p> : null}

            {isOpen ? (
              <div className="flex flex-col gap-1 border-t border-border/60 p-1.5">
                {module.lessons.map((lesson) => {
                  const isCurrent = lesson.id === currentLessonId;
                  const isLocked = !lesson.assigned;
                  const isCompleted = Boolean(lesson.completedAt);
                  const isNavigating = isPending && pendingId === lesson.id;
                  const FormatIcon = FORMAT_ICON[lesson.format];

                  const rowClasses = cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-200",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isCurrent && "bg-accent font-semibold text-foreground",
                    !isCurrent && !isLocked && "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    isLocked && "cursor-not-allowed text-muted-foreground/50"
                  );

                  const statusIcon = isNavigating ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                  ) : isLocked ? (
                    <Lock className="size-4 shrink-0" aria-hidden="true" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <Circle className="size-4 shrink-0" aria-hidden="true" />
                  );

                  if (isLocked) {
                    return (
                      <div key={lesson.id} className={rowClasses} aria-disabled="true">
                        {statusIcon}
                        <FormatIcon className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{lesson.title}</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => goTo(lesson.id)}
                      aria-current={isCurrent ? "page" : undefined}
                      className={rowClasses}
                    >
                      {statusIcon}
                      <FormatIcon className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{lesson.title}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
