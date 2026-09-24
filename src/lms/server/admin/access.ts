import { db } from "@/shared/lib/db";
import { DEFAULT_COURSE_TITLE } from "@/lms/server/repos/default-module";

// Read models for /admin/access (course enrollment + abonement management).

export type AccessCourseOption = {
  id: string;
  title: string;
  examType: string | null;
  subject: string | null;
  moduleCount: number;
  activeCount: number;
};

export async function getAccessCourses(): Promise<AccessCourseOption[]> {
  const courses = await db.course.findMany({
    // The "Общий курс" bucket holds unsorted lessons, not a real curriculum.
    where: { title: { not: DEFAULT_COURSE_TITLE } },
    orderBy: [{ title: "asc" }],
    select: {
      id: true,
      title: true,
      examType: true,
      subject: true,
      _count: { select: { modules: true, enrollments: { where: { status: "ACTIVE" } } } },
    },
  });
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    examType: c.examType,
    subject: c.subject,
    moduleCount: c._count.modules,
    activeCount: c._count.enrollments,
  }));
}

export type RosterEntry = {
  id: string;
  status: "ACTIVE" | "SUSPENDED" | "COMPLETED";
  enrolledAt: string;
  accessThroughModule: number | null;
  student: { id: string; fullName: string; email: string | null };
  sourceGroupName: string | null;
};

export type CourseRoster = {
  course: { id: string; title: string; examType: string | null; subject: string | null };
  modules: { id: string; title: string; isPublished: boolean; unlockMode: string }[];
  enrollments: RosterEntry[];
};

export async function getCourseRoster(courseId: string): Promise<CourseRoster | null> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      title: true,
      examType: true,
      subject: true,
      modules: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: { id: true, title: true, isPublished: true, unlockMode: true },
      },
      enrollments: {
        orderBy: [{ student: { fullName: "asc" } }, { id: "asc" }],
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          accessThroughModule: true,
          student: { select: { id: true, fullName: true, email: true } },
          sourceGroup: { select: { name: true } },
        },
      },
    },
  });
  if (!course) return null;

  return {
    course: { id: course.id, title: course.title, examType: course.examType, subject: course.subject },
    modules: course.modules,
    enrollments: course.enrollments.map((e) => ({
      id: e.id,
      status: e.status,
      enrolledAt: e.enrolledAt.toISOString(),
      accessThroughModule: e.accessThroughModule,
      student: e.student,
      sourceGroupName: e.sourceGroup?.name ?? null,
    })),
  };
}

export type GroupOption = { id: string; name: string; subject: string | null; examType: string | null; memberCount: number };

export async function getGroupOptions(): Promise<GroupOption[]> {
  const groups = await db.group.findMany({
    where: { deletedAt: null },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      subject: true,
      examType: true,
      _count: { select: { students: { where: { student: { deletedAt: null } } } } },
    },
  });
  return groups.map((g) => ({ id: g.id, name: g.name, subject: g.subject, examType: g.examType, memberCount: g._count.students }));
}

export type StudentOption = { id: string; fullName: string; email: string | null };

export async function getStudentOptions(): Promise<StudentOption[]> {
  return db.user.findMany({
    where: { role: "STUDENT" },
    orderBy: [{ fullName: "asc" }],
    select: { id: true, fullName: true, email: true },
  });
}
