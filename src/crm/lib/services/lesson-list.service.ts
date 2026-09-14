import type { Prisma } from "@prisma/client";
import { db } from "@/shared/lib/db";
import { isLessonConcluded } from "@/crm/lib/lessonTime";
import {
  classifyLessonAttendance,
  needsAttention,
  resolveLessonDateWindow,
  type AttendanceCardinalityStatus,
} from "@/crm/lib/lessonFilters";
import type { LessonListFilters } from "@/crm/lib/schemas";
import type { LessonType } from "@/crm/lib/types";

export interface LessonListRow {
  id: string;
  type: LessonType;
  groupId: string | null;
  studentId: string | null;
  teacherId: string;
  scheduledAt: Date;
  durationMinutes: number;
  pricePerLesson: number | null;
  isTrial: boolean;
  status: string;
  recurrenceGroupId: string | null;
  teacher: { id: string; fullName: string } | null;
  group: { id: string; name: string; teacherId: string | null; studentCount: number } | null;
  student: { id: string; fullName: string } | null;
  enrolledCount: number;
  markedCount: number;
  attendanceStatus: AttendanceCardinalityStatus;
}

export interface ListLessonsPageOpts {
  sessionUser: { id: string; role: string };
  filters: LessonListFilters;
  now?: Date;
}

export interface ListLessonsPageResult {
  lessons: LessonListRow[];
  total: number;
  page: number;
  pageSize: number;
}

const LESSON_LIST_SELECT = {
  id: true,
  type: true,
  groupId: true,
  studentId: true,
  teacherId: true,
  scheduledAt: true,
  durationMinutes: true,
  pricePerLesson: true,
  isTrial: true,
  status: true,
  recurrenceGroupId: true,
  teacher: { select: { id: true, fullName: true } },
  group: {
    select: { id: true, name: true, teacherId: true, subject: true, _count: { select: { students: true } } },
  },
  student: { select: { id: true, fullName: true } },
  _count: { select: { attendance: true } },
} satisfies Prisma.ClassSessionSelect;

type RawLessonRow = Prisma.ClassSessionGetPayload<{ select: typeof LESSON_LIST_SELECT }>;

function toLessonListRow(raw: RawLessonRow, now: Date): LessonListRow {
  const enrolledCount = raw.type === "INDIVIDUAL" ? (raw.studentId ? 1 : 0) : (raw.group?._count.students ?? 0);
  const markedCount = raw._count.attendance;
  const concluded = isLessonConcluded({ scheduledAt: raw.scheduledAt, durationMinutes: raw.durationMinutes }, now);
  const attendanceStatus = classifyLessonAttendance({
    sessionStatus: raw.status,
    concluded,
    enrolledCount,
    markedCount,
  });

  return {
    id: raw.id,
    type: raw.type as LessonType,
    groupId: raw.groupId,
    studentId: raw.studentId,
    teacherId: raw.teacherId,
    scheduledAt: raw.scheduledAt,
    durationMinutes: raw.durationMinutes,
    pricePerLesson: raw.pricePerLesson ? Number(raw.pricePerLesson) : null,
    isTrial: raw.isTrial,
    status: raw.status,
    recurrenceGroupId: raw.recurrenceGroupId,
    teacher: raw.teacher,
    group: raw.group
      ? { id: raw.group.id, name: raw.group.name, teacherId: raw.group.teacherId, studentCount: raw.group._count.students }
      : null,
    student: raw.student,
    enrolledCount,
    markedCount,
    attendanceStatus,
  };
}

function buildWhere(
  sessionUser: { id: string; role: string },
  filters: LessonListFilters,
  window: ReturnType<typeof resolveLessonDateWindow>,
): Prisma.ClassSessionWhereInput {
  const isTeacher = sessionUser.role === "TEACHER";
  const AND: Prisma.ClassSessionWhereInput[] = [];

  // A TEACHER is always self-scoped, regardless of any teacherId filter they
  // (or a tampered request) might supply -- this is the RBAC data-isolation
  // boundary, enforced here rather than trusted from the caller.
  if (isTeacher) {
    AND.push({ OR: [{ teacherId: sessionUser.id }, { group: { teacherId: sessionUser.id } }] });
  } else if (filters.teacherId) {
    AND.push({ OR: [{ teacherId: filters.teacherId }, { group: { teacherId: filters.teacherId } }] });
  }

  if (filters.format === "GROUP" || filters.format === "INDIVIDUAL") {
    AND.push({ type: filters.format });
  }

  // NEEDS_ATTENTION/COMPLETED are cardinality-derived (Task 4/comment below)
  // and are never expressed here.
  if (filters.status === "SCHEDULED") AND.push({ status: "scheduled" });
  if (filters.status === "CANCELLED") AND.push({ status: "cancelled" });
  if (filters.status === "TRIAL") AND.push({ isTrial: true });

  if (window.gte || window.lt) {
    AND.push({
      scheduledAt: {
        ...(window.gte ? { gte: window.gte } : {}),
        ...(window.lt ? { lt: window.lt } : {}),
      },
    });
  }

  const q = filters.q.trim();
  if (q) {
    AND.push({
      OR: [
        { group: { name: { contains: q, mode: "insensitive" } } },
        { group: { subject: { contains: q, mode: "insensitive" } } },
        { student: { fullName: { contains: q, mode: "insensitive" } } },
        { teacher: { fullName: { contains: q, mode: "insensitive" } } },
        { group: { students: { some: { student: { fullName: { contains: q, mode: "insensitive" } } } } } },
      ],
    });
  }

  return AND.length > 0 ? { AND } : {};
}

// Cardinality-derived statuses (NEEDS_ATTENTION, COMPLETED) compare two
// per-row counts, so they can't be expressed as a single SQL WHERE -- they're
// classified after fetching. Both statuses only ever apply to concluded
// (past) lessons, so the fetch is first narrowed to scheduledAt <= now; this
// cap bounds the in-memory pass even for a school with years of history.
const CARDINALITY_STATUS_FETCH_CAP = 2000;

export async function listLessonsPage(opts: ListLessonsPageOpts): Promise<ListLessonsPageResult> {
  const { sessionUser, filters } = opts;
  const now = opts.now ?? new Date();
  const window = resolveLessonDateWindow(filters, now);
  const where = buildWhere(sessionUser, filters, window);

  if (filters.status === "NEEDS_ATTENTION" || filters.status === "COMPLETED") {
    const concludedWhere: Prisma.ClassSessionWhereInput = { AND: [where, { scheduledAt: { lte: now } }] };

    const rows = await db.classSession.findMany({
      where: concludedWhere,
      orderBy: [{ scheduledAt: window.orderDirection }, { id: "asc" }],
      take: CARDINALITY_STATUS_FETCH_CAP,
      select: LESSON_LIST_SELECT,
    });

    const classified = rows
      .map((row) => toLessonListRow(row, now))
      .filter((row) =>
        filters.status === "NEEDS_ATTENTION" ? needsAttention(row.attendanceStatus) : row.attendanceStatus === "COMPLETED",
      );

    const start = (filters.page - 1) * filters.pageSize;
    return {
      lessons: classified.slice(start, start + filters.pageSize),
      total: classified.length,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  const [rows, total] = await Promise.all([
    db.classSession.findMany({
      where,
      orderBy: [{ scheduledAt: window.orderDirection }, { id: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: LESSON_LIST_SELECT,
    }),
    db.classSession.count({ where }),
  ]);

  return {
    lessons: rows.map((row) => toLessonListRow(row, now)),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}
