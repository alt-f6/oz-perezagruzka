import { notFound } from "next/navigation";
import { db } from "@/shared/lib/db";
import { getSessionUser } from "@/shared/lib/auth";
import type {
  AttendanceRecord,
  ClassSessionWithGroup,
  MakeupLessonOption,
  Student,
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

  const sessionUser = await getSessionUser();

  const lesson = await db.classSession.findUnique({
    where: { id },
    select: {
      id: true,
      groupId: true,
      scheduledAt: true,
      status: true,
      group: { select: { id: true, name: true, teacherId: true } },
    },
  });

  if (!lesson) {
    notFound();
  }

  const [groupStudents, attendance, makeupOptions] = await Promise.all([
    db.groupStudent.findMany({
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
    }),
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
  ]);

  const students = groupStudents
    .map((row) => row.student)
    .filter(Boolean)
    .map(
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
      userRole={sessionUser?.role}
      makeupOptions={makeupOptions as unknown as MakeupLessonOption[]}
    />
  );
}
