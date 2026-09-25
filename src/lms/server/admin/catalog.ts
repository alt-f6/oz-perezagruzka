import { Prisma } from "@prisma/client";

import { db } from "@/shared/lib/db";
import type { SessionUser } from "@/shared/lib/auth";
import { DEFAULT_COURSE_TITLE } from "@/lms/server/repos/default-module";
import { getLessonContentKinds, type LessonContentKind } from "@/lms/lib/lesson-readiness";
import type { LessonFilters } from "@/lms/lib/lesson-filters";

// Read models for the LMS admin dashboard and lessons directory.
//
// Scoping: TEACHER only ever sees courses they own (Course.teacherId);
// ADMIN/MANAGER see everything. (The admin area itself is ADMIN/MANAGER-only
// now; teachers browse via /teacher/*, scoped by src/lms/server/teacher-access.ts.) Every query here goes through courseScope /
// lessonScope so a teacher's numbers can never include other teachers' data.

export type CatalogViewer = Pick<SessionUser, "id" | "role">;

export function isCatalogEditor(viewer: CatalogViewer): boolean {
  return viewer.role === "ADMIN" || viewer.role === "MANAGER";
}

function scopedTeacherId(viewer: CatalogViewer): string | null {
  return viewer.role === "TEACHER" ? viewer.id : null;
}

export function courseScope(viewer: CatalogViewer): Prisma.CourseWhereInput {
  const teacherId = scopedTeacherId(viewer);
  return teacherId ? { teacherId } : {};
}

export function lessonScope(viewer: CatalogViewer): Prisma.LessonWhereInput {
  const teacherId = scopedTeacherId(viewer);
  return teacherId ? { module: { course: { teacherId } } } : {};
}

const EMPTY_LESSON_WHERE: Prisma.LessonWhereInput = {
  content: "",
  presentationEmbedUrl: null,
  media: { none: {} },
  assets: { none: {} },
};

// ─── Unanswered questions ──────────────────────────────────────────────────

export type UnansweredSummary = { count: number; oldestAt: Date | null };

/**
 * A lesson×student thread is "unanswered" when its latest message is from the
 * student. DISTINCT ON picks each thread's latest row in one pass.
 */
export async function getUnansweredSummary(viewer: CatalogViewer): Promise<UnansweredSummary> {
  const teacherId = scopedTeacherId(viewer);

  const rows = await db.$queryRaw<{ count: number; oldest: Date | null }[]>(Prisma.sql`
    SELECT COUNT(*)::int AS count, MIN(t."createdAt") AS oldest
    FROM (
      SELECT DISTINCT ON (m."lessonId", m."studentId") m."senderRole", m."createdAt"
      FROM "lesson_messages" m
      JOIN "Lesson" l ON l."id" = m."lessonId"
      JOIN "Module" mo ON mo."id" = l."moduleId"
      JOIN "Course" c ON c."id" = mo."courseId"
      WHERE (${teacherId}::text IS NULL OR c."teacherId" = ${teacherId}::text)
      ORDER BY m."lessonId", m."studentId", m."createdAt" DESC, m."id" DESC
    ) t
    WHERE t."senderRole" = 'STUDENT'
  `);

  return { count: rows[0]?.count ?? 0, oldestAt: rows[0]?.oldest ?? null };
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export type DashboardStats = {
  activeStudents7d: number;
  totalStudents: number;
  lessons: { total: number; published: number; draft: number; empty: number };
  staleDrafts: number;
  storageBytes: number;
  unanswered: UnansweredSummary;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getDashboardStats(viewer: CatalogViewer, now = new Date()): Promise<DashboardStats> {
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const staleBefore = new Date(now.getTime() - 30 * DAY_MS);
  const scope = lessonScope(viewer);
  const teacherScoped = scopedTeacherId(viewer) !== null;

  const [progressIds, messageIds, sessionIds, totalStudents, total, published, empty, staleDrafts, storage, unanswered] =
    await Promise.all([
      db.lessonProgress.findMany({
        where: { updatedAt: { gte: since }, lesson: scope },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      db.lessonMessage.findMany({
        where: { createdAt: { gte: since }, senderRole: "STUDENT", lesson: scope },
        select: { studentId: true },
        distinct: ["studentId"],
      }),
      // Logins are course-agnostic, so they only count toward the unscoped view.
      teacherScoped
        ? Promise.resolve([] as { userId: string }[])
        : db.session.findMany({
            where: { createdAt: { gte: since }, user: { role: "STUDENT" } },
            select: { userId: true },
            distinct: ["userId"],
          }),
      teacherScoped
        ? db.enrollment
            .findMany({
              where: { status: "ACTIVE", course: courseScope(viewer) },
              select: { studentId: true },
              distinct: ["studentId"],
            })
            .then((rows) => rows.length)
        : db.user.count({ where: { role: "STUDENT" } }),
      db.lesson.count({ where: scope }),
      db.lesson.count({ where: { ...scope, isPublished: true } }),
      db.lesson.count({ where: { ...scope, ...EMPTY_LESSON_WHERE } }),
      db.lesson.count({ where: { ...scope, isPublished: false, updatedAt: { lt: staleBefore } } }),
      db.lessonAsset.aggregate({ where: { lesson: scope }, _sum: { sizeBytes: true } }),
      getUnansweredSummary(viewer),
    ]);

  const active = new Set<string>([
    ...progressIds.map((r) => r.studentId),
    ...messageIds.map((r) => r.studentId),
    ...sessionIds.map((r) => r.userId),
  ]);

  return {
    activeStudents7d: active.size,
    totalStudents,
    lessons: { total, published, draft: total - published, empty },
    staleDrafts,
    storageBytes: Number(storage._sum.sizeBytes ?? 0),
    unanswered,
  };
}

export type RecentLesson = {
  id: string;
  title: string;
  isPublished: boolean;
  updatedAt: Date;
  courseTitle: string;
  isUncategorized: boolean;
};

export async function getRecentLessons(viewer: CatalogViewer, take = 8): Promise<RecentLesson[]> {
  const rows = await db.lesson.findMany({
    where: lessonScope(viewer),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      title: true,
      isPublished: true,
      updatedAt: true,
      module: { select: { course: { select: { title: true } } } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    isPublished: r.isPublished,
    updatedAt: r.updatedAt,
    courseTitle: r.module.course.title,
    isUncategorized: r.module.course.title === DEFAULT_COURSE_TITLE,
  }));
}

export type CourseSummary = {
  id: string;
  title: string;
  subject: string | null;
  examType: string | null;
  grade: number | null;
  isPublished: boolean;
  isUncategorized: boolean;
  teacherId: string;
  teacherName: string;
  /** Explicit CourseTeacher links, on top of the owner. */
  linkedTeacherIds: string[];
  moduleCount: number;
  lessonCount: number;
  publishedLessonCount: number;
  activeEnrollments: number;
};

export async function getCourseSummaries(viewer: CatalogViewer): Promise<CourseSummary[]> {
  const courses = await db.course.findMany({
    where: courseScope(viewer),
    orderBy: [{ title: "asc" }],
    select: {
      id: true,
      title: true,
      subject: true,
      examType: true,
      grade: true,
      isPublished: true,
      teacherId: true,
      teacher: { select: { fullName: true } },
      teachers: { select: { teacherId: true } },
      _count: { select: { modules: true, enrollments: { where: { status: "ACTIVE" } } } },
      modules: { select: { lessons: { select: { isPublished: true } } } },
    },
  });

  return courses.map((c) => {
    const lessons = c.modules.flatMap((m) => m.lessons);
    return {
      id: c.id,
      title: c.title,
      subject: c.subject,
      examType: c.examType,
      grade: c.grade,
      isPublished: c.isPublished,
      isUncategorized: c.title === DEFAULT_COURSE_TITLE,
      teacherId: c.teacherId,
      teacherName: c.teacher.fullName,
      linkedTeacherIds: c.teachers.map((t) => t.teacherId),
      moduleCount: c._count.modules,
      lessonCount: lessons.length,
      publishedLessonCount: lessons.filter((l) => l.isPublished).length,
      activeEnrollments: c._count.enrollments,
    };
  });
}

// ─── Lessons directory ─────────────────────────────────────────────────────

export type DirectoryLesson = {
  id: string;
  title: string;
  description: string;
  order: number;
  isPublished: boolean;
  kinds: LessonContentKind[];
  directAssignments: number;
  updatedAt: string;
};

export type DirectoryModule = {
  id: string;
  title: string;
  order: number;
  isPublished: boolean;
  unlockMode: "MANUAL" | "DRIP_ENROLLMENT" | "FIXED_DATE";
  unlockAfterDays: number | null;
  unlockAt: string | null;
  lessons: DirectoryLesson[];
};

export type DirectoryCourse = {
  id: string;
  title: string;
  subject: string | null;
  examType: string | null;
  grade: number | null;
  isUncategorized: boolean;
  activeEnrollments: number;
  totalLessons: number;
  publishedLessons: number;
  modules: DirectoryModule[];
};

export type LessonsDirectory = {
  courses: DirectoryCourse[];
  totals: { lessons: number; published: number; matched: number };
  /** Every module the viewer can target, for "move to module" pickers. */
  moduleOptions: { id: string; title: string; courseTitle: string }[];
  courseOptions: { id: string; title: string }[];
};

function lessonFilterWhere(filters: LessonFilters): Prisma.LessonWhereInput {
  const where: Prisma.LessonWhereInput = {};
  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.status === "published") where.isPublished = true;
  if (filters.status === "draft") where.isPublished = false;
  if (filters.status === "empty") Object.assign(where, EMPTY_LESSON_WHERE);
  return where;
}

export async function getLessonsDirectory(viewer: CatalogViewer, filters: LessonFilters): Promise<LessonsDirectory> {
  const courseWhere: Prisma.CourseWhereInput = {
    ...courseScope(viewer),
    ...(filters.exam ? { examType: filters.exam } : {}),
    ...(filters.subject ? { subject: filters.subject } : {}),
    ...(filters.course ? { id: filters.course } : {}),
  };
  const lessonWhere = lessonFilterWhere(filters);
  const lessonFilterActive = Boolean(filters.q || filters.status);

  const [courses, allCourses] = await Promise.all([
    db.course.findMany({
      where: courseWhere,
      orderBy: [{ title: "asc" }],
      select: {
        id: true,
        title: true,
        subject: true,
        examType: true,
        grade: true,
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
        modules: {
          orderBy: [{ order: "asc" }, { id: "asc" }],
          select: {
            id: true,
            title: true,
            order: true,
            isPublished: true,
            unlockMode: true,
            unlockAfterDays: true,
            unlockAt: true,
            lessons: {
              where: lessonWhere,
              orderBy: [{ order: "asc" }, { id: "asc" }],
              select: {
                id: true,
                title: true,
                description: true,
                order: true,
                isPublished: true,
                content: true,
                presentationEmbedUrl: true,
                updatedAt: true,
                media: { select: { kind: true } },
                assets: { select: { kind: true } },
                _count: { select: { assignments: true } },
              },
            },
          },
        },
      },
    }),
    db.course.findMany({
      where: courseScope(viewer),
      orderBy: [{ title: "asc" }],
      select: {
        id: true,
        title: true,
        modules: { orderBy: [{ order: "asc" }, { id: "asc" }], select: { id: true, title: true } },
      },
    }),
  ]);

  const publishedCounts = await db.lesson.groupBy({
    by: ["moduleId", "isPublished"],
    where: { module: { courseId: { in: courses.map((c) => c.id) } } },
    _count: { _all: true },
  });
  const moduleTotals = new Map<string, { total: number; published: number }>();
  for (const row of publishedCounts) {
    const t = moduleTotals.get(row.moduleId) ?? { total: 0, published: 0 };
    t.total += row._count._all;
    if (row.isPublished) t.published += row._count._all;
    moduleTotals.set(row.moduleId, t);
  }

  let matched = 0;
  let totalLessons = 0;
  let totalPublished = 0;

  const mapped: DirectoryCourse[] = courses
    .map((c) => {
      const modules: DirectoryModule[] = c.modules.map((m) => ({
        id: m.id,
        title: m.title,
        order: m.order,
        isPublished: m.isPublished,
        unlockMode: m.unlockMode,
        unlockAfterDays: m.unlockAfterDays,
        unlockAt: m.unlockAt ? m.unlockAt.toISOString() : null,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          description: l.description,
          order: l.order,
          isPublished: l.isPublished,
          kinds: getLessonContentKinds(l),
          directAssignments: l._count.assignments,
          updatedAt: l.updatedAt.toISOString(),
        })),
      }));

      const totals = c.modules.reduce(
        (acc, m) => {
          const t = moduleTotals.get(m.id) ?? { total: 0, published: 0 };
          return { total: acc.total + t.total, published: acc.published + t.published };
        },
        { total: 0, published: 0 },
      );

      totalLessons += totals.total;
      totalPublished += totals.published;
      matched += modules.reduce((n, m) => n + m.lessons.length, 0);

      return {
        id: c.id,
        title: c.title,
        subject: c.subject,
        examType: c.examType,
        grade: c.grade,
        isUncategorized: c.title === DEFAULT_COURSE_TITLE,
        activeEnrollments: c._count.enrollments,
        totalLessons: totals.total,
        publishedLessons: totals.published,
        // With a lesson-level filter active, hide modules that matched nothing.
        modules: lessonFilterActive ? modules.filter((m) => m.lessons.length > 0) : modules,
      };
    })
    .filter((c) => !lessonFilterActive || c.modules.length > 0)
    // The uncategorized bucket is pinned first: it is the "inbox" to sort out.
    .sort((a, b) => Number(b.isUncategorized) - Number(a.isUncategorized));

  return {
    courses: mapped,
    totals: { lessons: totalLessons, published: totalPublished, matched },
    moduleOptions: allCourses.flatMap((c) =>
      c.modules.map((m) => ({ id: m.id, title: m.title, courseTitle: c.title })),
    ),
    courseOptions: allCourses.map((c) => ({ id: c.id, title: c.title })),
  };
}

export type CourseOwnerOption = { id: string; fullName: string; role: string };

/** Staff who can own a course; a TEACHER owner scopes that teacher's catalog. */
export async function getCourseOwnerOptions(): Promise<CourseOwnerOption[]> {
  return db.user.findMany({
    where: { role: { in: ["TEACHER", "ADMIN", "MANAGER"] }, isArchived: false },
    orderBy: [{ role: "desc" }, { fullName: "asc" }],
    select: { id: true, fullName: true, role: true },
  });
}
