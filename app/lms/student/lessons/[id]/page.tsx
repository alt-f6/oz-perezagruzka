import { Suspense } from "react";
import { notFound } from "next/navigation";

import { requireRoleForPage } from "@/shared/lib/rbac";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { roleHome } from "@/lms/server/auth/types";
import { db } from "@/shared/lib/db";
import { canViewLesson } from "@/lms/server/access/can-view-lesson";
import { computeModuleUnlockStatus } from "@/lms/server/access/module-unlock";
import { LessonTheaterViewer } from "@/lms/components/student/LessonTheaterViewer";
import { LessonViewerSkeleton } from "@/lms/components/student/LessonViewerSkeleton";
import type { CurriculumModule, CurriculumLesson } from "@/lms/components/student/CurriculumSidebar";
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
      homeworkTask: true,
      module: { select: { courseId: true } },
    },
  });

  if (!lessonRow) {
    notFound();
  }

  const lesson = lessonRow;
  const practiceLink = lesson.practiceLinkUrl ? { url: lesson.practiceLinkUrl, label: lesson.practiceLinkLabel } : null;

  const mediaRows = await db.lessonMedia.findMany({
    where: { lessonId, isPublic: true },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true, title: true, embedUrl: true, provider: true, kind: true, order: true },
  });
  const media = mediaRows.filter((m) => m.kind !== "presentation");
  const presentations = mediaRows
    .filter((m) => m.kind === "presentation")
    .map((m) => ({ id: m.id, title: m.title, url: m.embedUrl, order: m.order }));

  const pdfs = await db.lessonAsset.findMany({
    where: { lessonId, kind: "pdf", isPublic: true },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true, title: true, order: true },
  });

  const audioAssets = await db.lessonAsset.findMany({
    where: { lessonId, kind: "audio", isPublic: true },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true, title: true, order: true },
  });

  const progress = await db.lessonProgress.findUnique({
    where: { studentId_lessonId: { studentId: user.id, lessonId } },
    select: { completedAt: true, lastPositionSeconds: true },
  });

  const courseId = lesson.module?.courseId ?? null;

  const [courseModules, enrollment] = await Promise.all([
    courseId
      ? db.module.findMany({
          where: { courseId },
          orderBy: [{ order: "asc" }, { id: "asc" }],
          select: {
            id: true,
            title: true,
            isPublished: true,
            unlockMode: true,
            unlockAfterDays: true,
            unlockAt: true,
            lessons: {
              where: { isPublished: true },
              orderBy: [{ order: "asc" }, { id: "asc" }],
              select: {
                id: true,
                title: true,
                order: true,
                assignments: { where: { studentId: user.id }, select: { id: true } },
                progress: { where: { studentId: user.id }, select: { completedAt: true } },
                media: { where: { kind: "video" }, select: { id: true }, take: 1 },
                assets: { where: { kind: { in: ["audio", "pdf", "presentation"] } }, select: { kind: true }, take: 1 },
              },
            },
          },
        })
      : Promise.resolve([]),
    courseId
      ? db.enrollment.findUnique({ where: { studentId_courseId: { studentId: user.id, courseId } } })
      : Promise.resolve(null),
  ]);

  const curriculum: CurriculumModule[] = courseModules.map((module) => {
    const { unlocked, unlocksAt } = computeModuleUnlockStatus(
      {
        unlockMode: module.unlockMode,
        unlockAfterDays: module.unlockAfterDays,
        unlockAt: module.unlockAt,
      },
      enrollment?.enrolledAt ?? new Date(0)
    );

    const moduleEnrolled = Boolean(enrollment && enrollment.status === "ACTIVE");

    const { locked, lockReason }: { locked: boolean; lockReason: CurriculumModule["lockReason"] } = !module.isPublished
      ? { locked: true, lockReason: "unpublished" }
      : !moduleEnrolled
        ? { locked: true, lockReason: null }
        : {
            locked: !unlocked,
            lockReason: unlocked ? null : module.unlockMode === "DRIP_ENROLLMENT" ? "drip" : module.unlockMode === "FIXED_DATE" ? "fixed_date" : null,
          };

    const moduleUnlockedAndPublished = module.isPublished && moduleEnrolled && unlocked;

    const lessons: CurriculumLesson[] = module.lessons.map((row) => {
      const format: CurriculumLesson["format"] =
        row.media.length > 0 ? "video" : row.assets.length > 0 && row.assets[0].kind === "audio" ? "audio" : row.assets.length > 0 ? "presentation" : "text";

      return {
        id: row.id,
        title: row.title,
        order: row.order,
        assigned: row.assignments.length > 0 || moduleUnlockedAndPublished,
        completedAt: row.progress[0]?.completedAt ? row.progress[0].completedAt.toISOString() : null,
        format,
      };
    });

    return {
      id: module.id,
      title: module.title,
      locked,
      lockReason,
      // When there's no active enrollment yet, computeModuleUnlockStatus was
      // called with a new Date(0) (1970) fallback enrollment date, so any
      // drip-based unlocksAt it returns is meaningless here. Null it out
      // explicitly -- the UI only renders unlocksAt for lockReason "drip" /
      // "fixed_date" / "unpublished", which never applies in this branch.
      unlocksAt: !moduleEnrolled ? null : unlocksAt ? unlocksAt.toISOString() : null,
      lessons,
    };
  });

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
        presentations={presentations}
        pdfs={pdfs.map((p) => ({ id: p.id, title: p.title, order: p.order }))}
        audio={audioAssets.map((a) => ({ id: a.id, title: a.title, order: a.order }))}
        homeworkTask={lesson.homeworkTask}
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
