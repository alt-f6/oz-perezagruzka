"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2, Lock } from "lucide-react";

import { cn } from "@/shared/lib/utils";

export type CurriculumLesson = {
  id: string;
  title: string;
  order: number;
  assigned: boolean;
  completedAt: string | null;
};

type Props = {
  lessons: CurriculumLesson[];
  currentLessonId: string;
  onNavigate?: () => void;
};

export function CurriculumSidebar({ lessons, currentLessonId, onNavigate }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function goTo(lessonId: string) {
    onNavigate?.();
    if (lessonId === currentLessonId) return;

    setPendingId(lessonId);
    startTransition(() => {
      router.push(`/student/lessons/${lessonId}`);
    });
  }

  return (
    <nav aria-label="Учебный план" className="flex flex-col gap-1">
      {lessons.map((lesson) => {
        const isCurrent = lesson.id === currentLessonId;
        const isLocked = !lesson.assigned;
        const isCompleted = Boolean(lesson.completedAt);
        const isNavigating = isPending && pendingId === lesson.id;

        const rowClasses = cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-200",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          isCurrent && "bg-accent font-semibold text-foreground",
          !isCurrent && !isLocked && "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          isLocked && "cursor-not-allowed text-muted-foreground/50"
        );

        const icon = isNavigating ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : isLocked ? (
          <Lock className="size-4 shrink-0" aria-hidden="true" />
        ) : isCurrent ? (
          <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
            <span className="motion-safe:absolute motion-safe:size-2 motion-safe:animate-ping motion-safe:rounded-full motion-safe:bg-primary/60" />
            <span className="relative size-2 rounded-full bg-primary" />
          </span>
        ) : isCompleted ? (
          <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <Circle className="size-4 shrink-0" aria-hidden="true" />
        );

        const statusLabel = isLocked
          ? "заблокирован"
          : isCurrent
          ? "текущий урок"
          : isCompleted
          ? "пройден"
          : "доступен";

        if (isLocked) {
          return (
            <div key={lesson.id} className={rowClasses} aria-disabled="true">
              {icon}
              <span className="truncate">{lesson.title}</span>
              <span className="sr-only">({statusLabel})</span>
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
            {icon}
            <span className="truncate">{lesson.title}</span>
            <span className="sr-only">({statusLabel})</span>
          </button>
        );
      })}
    </nav>
  );
}
