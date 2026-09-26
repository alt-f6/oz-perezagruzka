import { db } from "@/shared/lib/db";
import { describeAccess } from "@/lms/lib/enrollment-access";
import { notFound } from "../errors";
import { toMoscowIso, toMoscowIsoOrNull } from "../time";
import { requireId } from "../validation";
import { toSafeStudent } from "./students.service";

// Who can open what. Enrollment.status maps to the API's access state:
// ACTIVE -> "active", SUSPENDED -> "revoked" (access taken away, row kept),
// COMPLETED -> "completed". Lesson-level Assignment rows have no revocation
// state: deleting the row is the revocation, so every existing one is active.

export type AccessState = "active" | "revoked" | "completed";

const ACCESS_STATE = { ACTIVE: "active", SUSPENDED: "revoked", COMPLETED: "completed" } as const;

const MAX_COURSE_ROSTER = 500;

const safeGroupOf = { where: { group: { deletedAt: null } }, take: 1, select: { group: { select: { name: true } } } } as const;

/** Resolves an LMS User id or a CRM Student id to the LMS account (if any). */
async function resolveStudent(id: string) {
  const user = await db.user.findFirst({
    where: { id, role: "STUDENT" },
    select: {
      id: true,
      fullName: true,
      students: { where: { deletedAt: null }, take: 1, select: { grade: true, groups: safeGroupOf } },
    },
  });
  if (user) {
    const p = user.students[0];
    return {
      userId: user.id,
      safe: toSafeStudent({ id: user.id, fullName: user.fullName, grade: p?.grade, group: p?.groups[0]?.group.name }),
    };
  }

  const student = await db.student.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, userId: true, fullName: true, grade: true, groups: safeGroupOf },
  });
  if (!student) return null;
  return {
    userId: student.userId,
    safe: toSafeStudent({
      id: student.userId ?? student.id,
      fullName: student.fullName,
      grade: student.grade,
      group: student.groups[0]?.group.name,
    }),
  };
}

export async function getStudentAccess(rawId: unknown) {
  const id = requireId(rawId, "Ученик");
  const resolved = await resolveStudent(id);
  if (!resolved) throw notFound("Ученик");

  if (!resolved.userId) {
    return { student: resolved.safe, hasLmsAccount: false, courses: [], lessons: [] };
  }

  const [enrollments, assignments] = await Promise.all([
    db.enrollment.findMany({
      where: { studentId: resolved.userId },
      orderBy: [{ enrolledAt: "desc" }, { id: "asc" }],
      select: {
        status: true,
        enrolledAt: true,
        completedAt: true,
        accessThroughModule: true,
        sourceGroup: { select: { name: true } },
        course: { select: { id: true, title: true, isPublished: true, _count: { select: { modules: true } } } },
      },
    }),
    db.assignment.findMany({
      where: { studentId: resolved.userId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        createdAt: true,
        lesson: {
          select: {
            id: true,
            title: true,
            module: { select: { course: { select: { id: true, title: true } } } },
          },
        },
      },
    }),
  ]);

  return {
    student: resolved.safe,
    hasLmsAccount: true,
    courses: enrollments.map((e) => ({
      courseId: e.course.id,
      courseTitle: e.course.title,
      coursePublished: e.course.isPublished,
      state: ACCESS_STATE[e.status] as AccessState,
      accessThroughModule: e.accessThroughModule,
      moduleCount: e.course._count.modules,
      accessLabel: describeAccess(e.accessThroughModule, e.course._count.modules),
      sourceGroup: e.sourceGroup?.name ?? null,
      enrolledAt: toMoscowIso(e.enrolledAt),
      completedAt: toMoscowIsoOrNull(e.completedAt),
    })),
    lessons: assignments.map((a) => ({
      lessonId: a.lesson.id,
      lessonTitle: a.lesson.title,
      course: a.lesson.module.course,
      state: "active" as AccessState,
      assignedAt: toMoscowIso(a.createdAt),
    })),
  };
}

export async function getCourseAccess(rawId: unknown) {
  const id = requireId(rawId, "Курс");
  const course = await db.course.findUnique({
    where: { id },
    select: { id: true, title: true, _count: { select: { modules: true, enrollments: true } } },
  });
  if (!course) throw notFound("Курс");

  const enrollments = await db.enrollment.findMany({
    where: { courseId: id },
    orderBy: [{ status: "asc" }, { student: { fullName: "asc" } }, { id: "asc" }],
    take: MAX_COURSE_ROSTER,
    select: {
      status: true,
      enrolledAt: true,
      accessThroughModule: true,
      sourceGroup: { select: { name: true } },
      student: {
        select: {
          id: true,
          fullName: true,
          students: { where: { deletedAt: null }, take: 1, select: { grade: true } },
        },
      },
    },
  });

  const moduleCount = course._count.modules;
  return {
    course: { id: course.id, title: course.title, moduleCount },
    total: course._count.enrollments,
    truncated: course._count.enrollments > enrollments.length,
    students: enrollments.map((e) => ({
      ...toSafeStudent({
        id: e.student.id,
        fullName: e.student.fullName,
        grade: e.student.students[0]?.grade,
        group: e.sourceGroup?.name,
      }),
      state: ACCESS_STATE[e.status] as AccessState,
      accessThroughModule: e.accessThroughModule,
      accessLabel: describeAccess(e.accessThroughModule, moduleCount),
      enrolledAt: toMoscowIso(e.enrolledAt),
    })),
  };
}
