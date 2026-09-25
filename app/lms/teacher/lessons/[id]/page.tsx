import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";

import { db } from "@/shared/lib/db";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { canViewLesson } from "@/lms/server/access/can-view-lesson";
import {
  CURRICULUM_FORMAT_SELECT,
  curriculumLessonFormat,
  loadLessonForView,
  loadLessonMaterials,
  practiceLinkOf,
} from "@/lms/server/lesson-view";
import { LessonTheaterViewer } from "@/lms/components/student/LessonTheaterViewer";
import { LessonViewerSkeleton } from "@/lms/components/student/LessonViewerSkeleton";
import type { CurriculumModule } from "@/lms/components/student/CurriculumSidebar";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const PREVIEW_MODE = { lessonBasePath: "/teacher/lessons" };

export default async function TeacherLessonPage({ params }: Props) {
  const user = await requireAuth();
  const { id: lessonId } = await params;

  // Course-scoped for TEACHER, drafts included; 404 either way so a teacher
  // can't probe other courses' lesson ids.
  if (!(await canViewLesson({ userId: user.id, role: user.role, lessonId }))) notFound();

  const lesson = await loadLessonForView(lessonId, { includeDrafts: true });
  if (!lesson) notFound();

  const [materials, modules] = await Promise.all([
    loadLessonMaterials(lesson),
    db.module.findMany({
      where: { courseId: lesson.module.courseId },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        lessons: {
          orderBy: [{ order: "asc" }, { id: "asc" }],
          select: { id: true, title: true, order: true, ...CURRICULUM_FORMAT_SELECT },
        },
      },
    }),
  ]);

  // Everything open, nothing completed: a teacher has no enrollment, drip
  // schedule or progress of their own.
  const curriculum: CurriculumModule[] = modules.map((m) => ({
    id: m.id,
    title: m.title,
    locked: false,
    lockReason: null,
    unlocksAt: null,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      order: l.order,
      assigned: true,
      completedAt: null,
      format: curriculumLessonFormat(l),
    })),
  }));

  return (
    <>
      <div className="border-b border-primary/20 bg-primary/10 px-5 py-2 text-sm font-medium text-foreground">
        <span className="mx-auto flex max-w-6xl items-center gap-2">
          <Eye className="size-4 shrink-0 text-primary-2" aria-hidden="true" />
          Режим преподавателя: Предпросмотр материалов урока
          {lesson.isPublished ? null : <span className="text-muted-foreground">· черновик, ученики его не видят</span>}
        </span>
      </div>
      <Suspense fallback={<LessonViewerSkeleton />}>
        <LessonTheaterViewer
          studentId={user.id}
          studentEmail={user.email}
          lesson={lesson}
          media={materials.media}
          presentations={materials.presentations}
          pdfs={materials.pdfs}
          audio={materials.audio}
          homeworkTask={lesson.homeworkTask}
          practiceLink={practiceLinkOf(lesson)}
          curriculum={curriculum}
          initialCompleted={false}
          initialPosition={0}
          previewMode={PREVIEW_MODE}
        />
      </Suspense>
    </>
  );
}
