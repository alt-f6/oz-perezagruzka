import { db } from "@/shared/lib/db";
import { mergeAccess, type AccessThrough } from "@/lms/lib/enrollment-access";

export async function getCourseModuleCount(courseId: string): Promise<number | null> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { _count: { select: { modules: true } } },
  });
  return course ? course._count.modules : null;
}

export type EnrollResult = { created: number; reactivated: number; widened: number; unchanged: number };

/**
 * Enrolls LMS student users into a course. Existing enrollments are
 * reactivated if suspended/completed and their abonement is only ever
 * widened (mergeAccess), never narrowed. sourceGroupId is recorded on newly
 * created rows only -- an existing enrollment keeps its original source.
 */
export async function enrollStudents(params: {
  courseId: string;
  studentIds: string[];
  accessThrough: AccessThrough;
  sourceGroupId?: string | null;
}): Promise<EnrollResult> {
  const { courseId, studentIds, accessThrough, sourceGroupId = null } = params;
  const result: EnrollResult = { created: 0, reactivated: 0, widened: 0, unchanged: 0 };
  if (studentIds.length === 0) return result;

  await db.$transaction(async (tx) => {
    const existing = await tx.enrollment.findMany({
      where: { courseId, studentId: { in: studentIds } },
      select: { id: true, studentId: true, status: true, accessThroughModule: true },
    });
    const byStudent = new Map(existing.map((e) => [e.studentId, e]));

    const toCreate = studentIds.filter((id) => !byStudent.has(id));
    if (toCreate.length > 0) {
      const created = await tx.enrollment.createMany({
        data: toCreate.map((studentId) => ({
          studentId,
          courseId,
          status: "ACTIVE" as const,
          accessThroughModule: accessThrough,
          sourceGroupId,
        })),
        skipDuplicates: true,
      });
      result.created = created.count;
    }

    for (const e of existing) {
      const nextAccess = mergeAccess(e.accessThroughModule, accessThrough);
      const reactivate = e.status !== "ACTIVE";
      const widen = nextAccess !== e.accessThroughModule;
      if (!reactivate && !widen) {
        result.unchanged += 1;
        continue;
      }
      await tx.enrollment.update({
        where: { id: e.id },
        data: { status: "ACTIVE", completedAt: null, accessThroughModule: nextAccess },
      });
      if (reactivate) result.reactivated += 1;
      else result.widened += 1;
    }
  });

  return result;
}

/** Of the given ids, those that are LMS student accounts. */
export async function filterStudentUserIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db.user.findMany({ where: { id: { in: ids }, role: "STUDENT" }, select: { id: true } });
  return rows.map((r) => r.id);
}

export type GroupSnapshot = {
  group: { id: string; name: string };
  /** Active group members with an LMS login, not yet actively enrolled. */
  toEnroll: { userId: string; fullName: string }[];
  alreadyEnrolled: { userId: string; fullName: string }[];
  /** CRM students with no LMS account -- they need a portal invite first. */
  withoutAccount: { studentId: string; fullName: string }[];
};

/**
 * Resolves a CRM group to LMS users for a one-off ("snapshot") enrollment.
 * Later membership changes in CRM do not affect enrollments made from it.
 */
export async function resolveGroupSnapshot(groupId: string, courseId: string): Promise<GroupSnapshot | null> {
  const group = await db.group.findFirst({
    where: { id: groupId, deletedAt: null },
    select: {
      id: true,
      name: true,
      students: {
        where: { student: { deletedAt: null } },
        select: {
          student: {
            select: { id: true, fullName: true, userId: true, user: { select: { role: true } } },
          },
        },
      },
    },
  });
  if (!group) return null;

  const members = group.students.map((gs) => gs.student);
  // Dedupe by login: two CRM student cards can point at the same LMS user.
  const withAccount = [
    ...new Map(
      members.filter((s) => s.userId && s.user?.role === "STUDENT").map((s) => [s.userId as string, s] as const),
    ).values(),
  ];
  const withoutAccount = members
    .filter((s) => !s.userId || s.user?.role !== "STUDENT")
    .map((s) => ({ studentId: s.id, fullName: s.fullName }));

  const active = await db.enrollment.findMany({
    where: { courseId, status: "ACTIVE", studentId: { in: withAccount.map((s) => s.userId as string) } },
    select: { studentId: true },
  });
  const activeIds = new Set(active.map((e) => e.studentId));

  const toEnroll: GroupSnapshot["toEnroll"] = [];
  const alreadyEnrolled: GroupSnapshot["alreadyEnrolled"] = [];
  for (const s of withAccount) {
    const entry = { userId: s.userId as string, fullName: s.fullName };
    (activeIds.has(entry.userId) ? alreadyEnrolled : toEnroll).push(entry);
  }

  return { group: { id: group.id, name: group.name }, toEnroll, alreadyEnrolled, withoutAccount };
}
