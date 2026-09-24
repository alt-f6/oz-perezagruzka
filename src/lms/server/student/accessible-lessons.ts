import { db } from "@/shared/lib/db";
import { computeModuleUnlockStatus, isWithinPaidAccess } from "@/lms/server/access/module-unlock";

// Every published lesson a student can currently open, from both access
// paths canViewLesson recognizes:
//   - direct per-lesson Assignment rows, and
//   - ACTIVE course enrollments, limited to published modules that pass both
//     their own unlock rule and the enrollment's abonement cursor.
// Deduped by lesson and sorted course -> module -> lesson so lists read in
// curriculum order.

export type AccessibleLesson = {
  id: string;
  title: string;
  description: string;
  order: number;
  courseTitle: string;
  moduleTitle: string;
  completedAt: Date | null;
  started: boolean;
  source: "assignment" | "course";
};

type SortKey = { courseCreatedAt: number; courseId: string; modulePosition: number; order: number; id: string };

function compare(a: SortKey, b: SortKey): number {
  return (
    a.courseCreatedAt - b.courseCreatedAt ||
    a.courseId.localeCompare(b.courseId) ||
    a.modulePosition - b.modulePosition ||
    a.order - b.order ||
    a.id.localeCompare(b.id)
  );
}

const LESSON_SELECT = (studentId: string) =>
  ({
    id: true,
    title: true,
    description: true,
    order: true,
    progress: { where: { studentId }, select: { completedAt: true } },
  }) as const;

export async function getAccessibleLessons(studentId: string, now: Date = new Date()): Promise<AccessibleLesson[]> {
  const [assignments, enrollments] = await Promise.all([
    db.assignment.findMany({
      where: { studentId, lesson: { isPublished: true } },
      select: {
        lesson: {
          select: {
            ...LESSON_SELECT(studentId),
            module: {
              select: {
                id: true,
                title: true,
                order: true,
                course: {
                  select: {
                    id: true,
                    title: true,
                    createdAt: true,
                    modules: { orderBy: [{ order: "asc" }, { id: "asc" }], select: { id: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.enrollment.findMany({
      where: { studentId, status: "ACTIVE" },
      select: {
        enrolledAt: true,
        accessThroughModule: true,
        course: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            modules: {
              orderBy: [{ order: "asc" }, { id: "asc" }],
              select: {
                id: true,
                title: true,
                isPublished: true,
                unlockMode: true,
                unlockAfterDays: true,
                unlockAt: true,
                lessons: { where: { isPublished: true }, select: LESSON_SELECT(studentId) },
              },
            },
          },
        },
      },
    }),
  ]);

  const byId = new Map<string, AccessibleLesson & SortKey>();

  for (const e of enrollments) {
    e.course.modules.forEach((m, index) => {
      const position = index + 1;
      if (!m.isPublished) return;
      if (!isWithinPaidAccess(position, e.accessThroughModule)) return;
      if (!computeModuleUnlockStatus(m, e.enrolledAt, now).unlocked) return;

      for (const l of m.lessons) {
        byId.set(l.id, {
          id: l.id,
          title: l.title,
          description: l.description,
          order: l.order,
          courseTitle: e.course.title,
          moduleTitle: m.title,
          completedAt: l.progress[0]?.completedAt ?? null,
          started: l.progress.length > 0,
          source: "course",
          courseCreatedAt: e.course.createdAt.getTime(),
          courseId: e.course.id,
          modulePosition: position,
        });
      }
    });
  }

  for (const { lesson: l } of assignments) {
    if (byId.has(l.id)) continue;
    const course = l.module.course;
    byId.set(l.id, {
      id: l.id,
      title: l.title,
      description: l.description,
      order: l.order,
      courseTitle: course.title,
      moduleTitle: l.module.title,
      completedAt: l.progress[0]?.completedAt ?? null,
      started: l.progress.length > 0,
      source: "assignment",
      courseCreatedAt: course.createdAt.getTime(),
      courseId: course.id,
      modulePosition: course.modules.findIndex((m) => m.id === l.module.id) + 1,
    });
  }

  return [...byId.values()].sort(compare).map(({ courseCreatedAt: _c, courseId: _i, modulePosition: _p, ...rest }) => rest);
}
