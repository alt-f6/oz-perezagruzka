import { getSessionUser } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import type { AttendanceRecord, StudentExamGoal, StudentExamResult } from "@/crm/lib/types";
import { StudentDashboardClient } from "./StudentDashboardClient";

export interface StudentLessonRow {
  id: string;
  scheduledAt: string;
  group?: { name: string } | { name: string }[] | null;
}

export default async function StudentDashboardPage() {
  const sessionUser = await getSessionUser();

  const profile = sessionUser
    ? await db.user.findUnique({
        where: { id: sessionUser.id },
        select: { id: true, fullName: true },
      })
    : null;

  const student = await db.student.findFirst({
    where: { userId: profile?.id || "" },
    select: { id: true, fullName: true },
  });

  if (!student) {
    return (
      <div className="rounded-2xl border border-border bg-white p-8 text-center text-accent/50">
        Профиль ученика не найден. Обратитесь к администратору.
      </div>
    );
  }

  const now = new Date().toISOString();

  const [groupStudentRows, attendanceRows, examGoalsRows, examResultsRows] = await Promise.all([
    db.groupStudent.findMany({
      where: { studentId: student.id },
      select: { groupId: true },
    }),
    db.attendance.findMany({
      where: { studentId: student.id },
      select: {
        id: true,
        classSessionId: true,
        studentId: true,
        status: true,
        grade: true,
        homeworkCompleted: true,
        comment: true,
      },
      take: 500,
      orderBy: { createdAt: "desc" },
    }),
    db.studentExamGoal.findMany({
      where: { studentId: student.id },
      select: { id: true, studentId: true, subject: true, startScore: true, targetScore: true },
    }),
    db.studentExamResult.findMany({
      where: { studentId: student.id },
      select: {
        id: true,
        studentId: true,
        subject: true,
        testName: true,
        currentScore: true,
        maxScore: true,
        testedAt: true,
      },
      orderBy: { testedAt: "asc" },
    }),
  ]);

  const groupIds = groupStudentRows.map((g) => g.groupId);

  const lessonRows =
    groupIds.length > 0
      ? await db.classSession.findMany({
          where: { groupId: { in: groupIds } },
          select: { id: true, scheduledAt: true, group: { select: { name: true } } },
          orderBy: { scheduledAt: "asc" },
          take: 500,
        })
      : [];

  const lessons: StudentLessonRow[] = lessonRows.map((l) => ({
    id: l.id,
    scheduledAt: l.scheduledAt.toISOString(),
    group: l.group,
  }));
  const upcomingLessons = lessons.filter((l) => l.scheduledAt >= now);
  const pastLessons = lessons.filter((l) => l.scheduledAt < now);

  return (
    <StudentDashboardClient
      studentName={student.fullName}
      upcomingLessons={upcomingLessons}
      pastLessons={pastLessons}
      attendance={attendanceRows as unknown as AttendanceRecord[]}
      examGoals={examGoalsRows as unknown as StudentExamGoal[]}
      examResults={examResultsRows as unknown as StudentExamResult[]}
    />
  );
}
