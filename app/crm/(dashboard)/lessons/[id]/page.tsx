import { notFound } from "next/navigation";
import { db } from "@/shared/lib/db";
import { requireRoleForPage } from "@/shared/lib/rbac";
import type {
  AttendanceRecord,
  ClassSessionWithGroup,
  MakeupLessonOption,
  Student,
  Submission,
} from "@/crm/lib/types";
import { AttendanceClient } from "./AttendanceClient";

type StudentWithTransactions = Student & {
  transactions?: { amount: number }[];
};

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sessionUser = await requireRoleForPage(["ADMIN", "MANAGER", "TEACHER"], {
    loginPath: "/admin/login",
    forbiddenPath: () => "/access-denied",
  });

  const lesson = await db.classSession.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      groupId: true,
      studentId: true,
      teacherId: true,
      scheduledAt: true,
      status: true,
      teacher: { select: { fullName: true } },
      group: { select: { id: true, name: true, teacherId: true } },
      student: {
        select: {
          id: true,
          fullName: true,
          phone: true,
          transactions: { select: { amount: true } },
        },
      },
    },
  });

  if (!lesson) {
    notFound();
  }

  // A teacher may also open a lesson whose own teacherId is stale (points at
  // a previous teacher after the group was reassigned) as long as the
  // group's *current* teacher is them -- see the matching schedule/lessons
  // list scoping in schedule-data.ts / lesson-list.service.ts.
  const ownedByTeacher =
    lesson.teacherId === sessionUser.id || lesson.group?.teacherId === sessionUser.id;
  if (sessionUser.role === "TEACHER" && !ownedByTeacher) {
    notFound();
  }

  const [groupStudents, attendance, makeupOptions, submissions] = await Promise.all([
    // INDIVIDUAL sessions have no group roster; the single student is joined
    // directly on the session and merged in below.
    lesson.groupId
      ? db.groupStudent.findMany({
          where: { groupId: lesson.groupId },
          select: {
            student: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                transactions: { select: { amount: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    db.attendance.findMany({
      where: { classSessionId: id },
      select: {
        id: true,
        classSessionId: true,
        studentId: true,
        status: true,
        grade: true,
        homeworkCompleted: true,
        makeupProvided: {
          select: {
            id: true,
            excusedAbsenceId: true,
            targetClassSessionId: true,
            targetClassSession: {
              select: {
                id: true,
                scheduledAt: true,
                group: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    db.classSession.findMany({
      where: {
        groupId: { not: lesson.groupId },
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: "asc" },
      take: 50,
      select: {
        id: true,
        scheduledAt: true,
        group: { select: { id: true, name: true } },
      },
    }),
    db.submission.findMany({
      where: { lessonId: id },
      select: {
        id: true,
        studentId: true,
        content: true,
        fileKey: true,
        status: true,
        score: true,
        teacherComment: true,
      },
    }),
  ]);

  const rosterStudents =
    groupStudents.length > 0
      ? groupStudents.map((row) => row.student).filter(Boolean)
      : lesson.student
        ? [lesson.student]
        : [];

  const students = rosterStudents.map(
    (s) =>
      ({
        ...s,
        transactions: s.transactions.map((t) => ({
          amount: Number(t.amount),
        })),
      }) as unknown as StudentWithTransactions,
  );

  const attendanceWithMakeup = attendance.map(({ makeupProvided, ...rest }) => ({
    ...rest,
    makeup: makeupProvided,
  }));

  return (
    <AttendanceClient
      lesson={lesson as unknown as ClassSessionWithGroup}
      students={students}
      attendance={attendanceWithMakeup as unknown as AttendanceRecord[]}
      submissions={submissions as unknown as Submission[]}
      userRole={sessionUser.role}
      makeupOptions={makeupOptions as unknown as MakeupLessonOption[]}
    />
  );
}
