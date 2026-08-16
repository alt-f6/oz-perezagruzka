import { Suspense } from "react";
import Link from "next/link";

import { requireRolePage } from "@/lms/server/auth/require-role-page";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { db } from "@/shared/lib/db";
import { canViewLesson } from "@/lms/server/access/can-view-lesson";
import { LessonTheaterViewer } from "@/lms/components/student/LessonTheaterViewer";
import { LessonViewerSkeleton } from "@/lms/components/student/LessonViewerSkeleton";
import type { CurriculumLesson } from "@/lms/components/student/CurriculumSidebar";
import { StudentLessonMessages } from "./StudentLessonMessages";

type Props = { params: Promise<{ id: string }> };

function NoticePage({ title, message }: { title: string; message: string }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Link
        href="/student/lessons"
        className="mb-4 inline-block text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        ← Назад к урокам
      </Link>
      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

export default async function StudentLessonPage({ params }: Props) {
  await requireRolePage("STUDENT");
  const user = await requireAuth();

  const { id } = await params;
  const lessonId = id;

  if (!lessonId) {
    return <NoticePage title="Некорректный ID урока" message="Проверьте ссылку и попробуйте снова." />;
  }

  const allowed = await canViewLesson({ userId: user.id, role: user.role, lessonId });

  if (!allowed) {
    return <NoticePage title="У вас нет доступа к этому уроку" message="Обратитесь к куратору, если это ошибка." />;
  }

  const lessonRow = await db.lesson.findUnique({
    where: { id: lessonId, isPublished: true },
    select: { id: true, title: true, description: true, content: true, order: true },
  });

  if (!lessonRow) {
    return <NoticePage title="Урок не найден или скрыт" message="Возможно, урок был снят с публикации." />;
  }

  const lesson = lessonRow;

  const media = await db.lessonMedia.findMany({
    where: { lessonId, isPublic: true },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true, title: true, embedUrl: true, provider: true, order: true },
  });

  const pdfs = await db.lessonAsset.findMany({
    where: { lessonId, kind: "pdf", isPublic: true },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true, title: true, order: true },
  });

  const progress = await db.lessonProgress.findUnique({
    where: { studentId_lessonId: { studentId: user.id, lessonId } },
    select: { completedAt: true, lastPositionSeconds: true },
  });

  const curriculumLessons = await db.lesson.findMany({
    where: { isPublished: true, assignments: { some: { studentId: user.id } } },
    include: {
      assignments: { where: { studentId: user.id } },
      progress: { where: { studentId: user.id } },
    },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });

  const curriculum: CurriculumLesson[] = curriculumLessons.map((row) => ({
    id: row.id,
    title: row.title,
    order: row.order,
    assigned: row.assignments.length > 0,
    completedAt: row.progress[0]?.completedAt ? row.progress[0].completedAt.toISOString() : null,
  }));

  return (
    <Suspense fallback={<LessonViewerSkeleton />}>
      <LessonTheaterViewer
        studentId={user.id}
        lesson={lesson}
        media={media.map((m) => ({
          id: m.id,
          title: m.title,
          embed_url: m.embedUrl,
          provider: m.provider,
          order: m.order,
        }))}
        pdfs={pdfs.map((p) => ({ id: p.id, title: p.title, order: p.order }))}
        curriculum={curriculum}
        initialCompleted={Boolean(progress?.completedAt)}
        initialPosition={Number(progress?.lastPositionSeconds ?? 0)}
      >
        <StudentLessonMessages lessonId={lessonId} />
      </LessonTheaterViewer>
    </Suspense>
  );
}
