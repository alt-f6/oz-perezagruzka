import { Suspense } from "react";
import { notFound } from "next/navigation";

import { requireRoleForPage } from "@/shared/lib/rbac";
import { LMS_ROLES } from "@/shared/lib/auth";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { roleHome } from "@/lms/server/auth/types";
import { db } from "@/shared/lib/db";
import { canViewLesson, isStaffPreviewRole } from "@/lms/server/access/can-view-lesson";
import { computeModuleUnlockStatus, isWithinPaidAccess } from "@/lms/server/access/module-unlock";
import {
  CURRICULUM_FORMAT_SELECT,
  curriculumLessonFormat,
  loadLessonForView,
  loadLessonMaterials,
  practiceLinkOf,
} from "@/lms/server/lesson-view";
import { LessonTheaterViewer } from "@/lms/components/student/LessonTheaterViewer";
import { LessonViewerSkeleton } from "@/lms/components/student/LessonViewerSkeleton";
import type { CurriculumModule, CurriculumLesson } from "@/lms/components/student/CurriculumSidebar";
import { StudentLessonMessages } from "./StudentLessonMessages";

type Props = { params: Promise<{ id: string }> };

export default async function StudentLessonPage({ params }: Props) {
  // LMS_ROLES = ["ADMIN", "MANAGER", "TEACHER", "STUDENT"]. PARENT has no LMS
  // access at all and is redirected via forbiddenPath, same as before.
  await requireRoleForPage(LMS_ROLES, {
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

  const isStaffPreview = isStaffPreviewRole(user.role);

  const lesson = await loadLessonForView(lessonId, { includeDrafts: isStaffPreview });
  if (!lesson) {
    notFound();
  }

  const practiceLink = practiceLinkOf(lesson);
  const { media, presentations, pdfs, audio: audioAssets } = await loadLessonMaterials(lesson);

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
              where: isStaffPreview ? undefined : { isPublished: true },
              orderBy: [{ order: "asc" }, { id: "asc" }],
              select: {
                id: true,
                title: true,
                order: true,
                assignments: { where: { studentId: user.id }, select: { id: true } },
                progress: { where: { studentId: user.id }, select: { completedAt: true } },
                ...CURRICULUM_FORMAT_SELECT,
              },
            },
          },
        })
      : Promise.resolve([]),
    courseId
      ? db.enrollment.findUnique({ where: { studentId_courseId: { studentId: user.id, courseId } } })
      : Promise.resolve(null),
  ]);

  const curriculum: CurriculumModule[] = courseModules.map((module, index) => {
    const { unlocked, unlocksAt } = computeModuleUnlockStatus(
      {
        unlockMode: module.unlockMode,
        unlockAfterDays: module.unlockAfterDays,
        unlockAt: module.unlockAt,
      },
      enrollment?.enrolledAt ?? new Date(0)
    );

    const moduleEnrolled = Boolean(enrollment && enrollment.status === "ACTIVE");
    // Monthly abonement: courseModules is in [order, id] order, so index+1 is
    // the position Enrollment.accessThroughModule counts against.
    const paid = isWithinPaidAccess(index + 1, enrollment?.accessThroughModule);

    const { locked, lockReason }: { locked: boolean; lockReason: CurriculumModule["lockReason"] } = !module.isPublished
      ? { locked: true, lockReason: "unpublished" }
      : !moduleEnrolled
        ? { locked: true, lockReason: null }
        : !paid
          ? { locked: true, lockReason: "not_paid" }
          : {
            locked: !unlocked,
            lockReason: unlocked ? null : module.unlockMode === "DRIP_ENROLLMENT" ? "drip" : module.unlockMode === "FIXED_DATE" ? "fixed_date" : null,
          };

    const moduleUnlockedAndPublished = module.isPublished && moduleEnrolled && paid && unlocked;

    const lessons: CurriculumLesson[] = module.lessons.map((row) => ({
      id: row.id,
      title: row.title,
      order: row.order,
      assigned: row.assignments.length > 0 || moduleUnlockedAndPublished,
      completedAt: row.progress[0]?.completedAt ? row.progress[0].completedAt.toISOString() : null,
      format: curriculumLessonFormat(row),
    }));

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
        media={media}
        presentations={presentations}
        pdfs={pdfs}
        audio={audioAssets}
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
