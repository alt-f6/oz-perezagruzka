"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Maximize2, Menu, Minimize2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/components/ui/sheet";
import { CurriculumSidebar, type CurriculumLesson } from "@/lms/components/student/CurriculumSidebar";
import { LessonStage } from "@/lms/components/student/LessonStage";
import { LessonCompletionToggle } from "@/lms/components/student/LessonCompletionToggle";

type MediaRow = { id: string; title: string | null; embed_url: string; provider: string; order: number };
type PdfRow = { id: string; title: string | null; order: number };

type Props = {
  studentId: string;
  lesson: { id: string; title: string; description: string; content: string; order: number };
  media: MediaRow[];
  pdfs: PdfRow[];
  curriculum: CurriculumLesson[];
  initialCompleted: boolean;
  initialPosition: number;
  children?: ReactNode;
};

export function LessonTheaterViewer({
  studentId,
  lesson,
  media,
  pdfs,
  curriculum,
  initialCompleted,
  initialPosition,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const theaterMode = searchParams.get("theater") === "true";
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const setTheaterMode = useCallback(
    (next: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("theater", "true");
      else params.delete("theater");

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;

      if (isTyping) return;

      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setTheaterMode(!theaterMode);
      } else if (e.key === "Escape" && theaterMode) {
        setTheaterMode(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [theaterMode, setTheaterMode]);

  const currentIndex = curriculum.findIndex((l) => l.id === lesson.id);
  const positionLabel =
    currentIndex >= 0 ? `Урок ${currentIndex + 1} из ${curriculum.length}` : null;

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-6 py-8">
      <aside
        className={cn(
          "hidden shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-out lg:block",
          theaterMode ? "w-0 opacity-0" : "w-64 opacity-100"
        )}
      >
        <div className="sticky top-8 w-64 rounded-2xl border border-border bg-card/60 p-3">
          <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Учебный план
          </p>
          <CurriculumSidebar lessons={curriculum} currentLessonId={lesson.id} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <Menu />
                  Уроки
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Учебный план</SheetTitle>
                </SheetHeader>
                <CurriculumSidebar
                  lessons={curriculum}
                  currentLessonId={lesson.id}
                  onNavigate={() => setMobileSidebarOpen(false)}
                />
              </SheetContent>
            </Sheet>

            {positionLabel ? (
              <span className="hidden text-sm font-semibold text-muted-foreground lg:inline">
                {positionLabel}
              </span>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <LessonCompletionToggle lessonId={lesson.id} initialCompleted={initialCompleted} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTheaterMode(!theaterMode)}
              aria-pressed={theaterMode}
              aria-label={theaterMode ? "Выйти из режима кинотеатра" : "Режим кинотеатра"}
            >
              {theaterMode ? <Minimize2 /> : <Maximize2 />}
              {theaterMode ? "Свернуть" : "Кинотеатр"}
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <span className="mb-2 inline-block rounded-full border border-border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Урок {lesson.order}
          </span>
          <h1 className="text-2xl font-black tracking-tight lg:text-3xl">{lesson.title}</h1>
          {lesson.description ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{lesson.description}</p>
          ) : null}
        </div>

        <LessonStage
          lessonId={lesson.id}
          studentId={studentId}
          media={media}
          pdfs={pdfs}
          initialPosition={initialPosition}
        />

        {lesson.content ? (
          <div className="mt-6 rounded-2xl border border-border bg-card/40 p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm">{lesson.content}</pre>
          </div>
        ) : null}

        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </div>
  );
}
