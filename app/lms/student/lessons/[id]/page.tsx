import { Suspense } from "react";
import { notFound } from "next/navigation";

import { requireRoleForPage } from "@/shared/lib/rbac";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { roleHome } from "@/lms/server/auth/types";
import { db } from "@/shared/lib/db";
import { canViewLesson } from "@/lms/server/access/can-view-lesson";
import { LessonTheaterViewer } from "@/lms/components/student/LessonTheaterViewer";
import { LessonViewerSkeleton } from "@/lms/components/student/LessonViewerSkeleton";
import type { CurriculumLesson } from "@/lms/components/student/CurriculumSidebar";
import { StudentLessonMessages } from "./StudentLessonMessages";

type Props = { params: Promise<{ id: string }> };

export default async function StudentLessonPage({ params }: Props) {
  await requireRoleForPage(["STUDENT"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });
  const user = await requireAuth();

  const { id } = await params;
  const lessonId = id;

  if (!lessonId) {
    notFound();
  }

  const allowed = await canViewLesson({ userId: user.id, role: user.role, lessonId });

  // 404 (not 403) for unassigned students: a bare "forbidden" would confirm
  // the lesson exists, leaking its presence to a student who isn't supposed
  // to know about it. Same not-found.tsx handles both cases indistinguishably.
  if (!allowed) {
    notFound();
  }

  const lessonRow = await db.lesson.findUnique({
    where: { id: lessonId, isPublished: true },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      order: true,
      practiceLinkUrl: true,
      practiceLinkLabel: true,
    },
  });

  if (!lessonRow) {
    notFound();
  }

  const lesson = lessonRow;
  const practiceLink = lesson.practiceLinkUrl ? { url: lesson.practiceLinkUrl, label: lesson.practiceLinkLabel } : null;

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
        studentEmail={user.email}
        lesson={lesson}
        media={media.map((m) => ({
          id: m.id,
          title: m.title,
          embed_url: m.embedUrl,
          provider: m.provider,
          order: m.order,
        }))}
        pdfs={pdfs.map((p) => ({ id: p.id, title: p.title, order: p.order }))}
        practiceLink={practiceLink}
        curriculum={curriculum}
        initialCompleted={Boolean(progress?.completedAt)}
        initialPosition={Number(progress?.lastPositionSeconds ?? 0)}
      >
        <StudentLessonMessages lessonId={lessonId} />
      </LessonTheaterViewer>
    </Suspense>
  );
}
