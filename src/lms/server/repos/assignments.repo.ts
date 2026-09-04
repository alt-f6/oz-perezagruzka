import { db } from "@/shared/lib/db";

export async function listStudents() {
  return db.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, email: true, fullName: true, role: true },
    orderBy: { id: "asc" },
    take: 1000,
  });
}

export async function listLessons() {
  return db.lesson.findMany({
    select: {
      id: true,
      title: true,
      isPublished: true,
      order: true,
      module: { select: { title: true, course: { select: { title: true } } } },
    },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    take: 1000,
  });
}

export async function listAssignmentsForStudent(studentId: string) {
  const rows = await db.assignment.findMany({
    where: { studentId },
    select: { lessonId: true },
    orderBy: { lessonId: "asc" },
  });
  return rows.map((r) => r.lessonId);
}

export async function grantLesson(studentId: string, lessonId: string) {
  await db.assignment.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    create: { studentId, lessonId },
    update: {},
  });
}

export async function revokeLesson(studentId: string, lessonId: string) {
  await db.assignment.deleteMany({ where: { studentId, lessonId } });
}

export async function setAssignmentsForStudent(studentId: string, lessonIds: string[]) {
  const ids = Array.from(new Set(lessonIds));

  await db.$transaction([
    db.assignment.deleteMany({ where: { studentId } }),
    ...(ids.length > 0
      ? [
          db.assignment.createMany({
            data: ids.map((lessonId) => ({ studentId, lessonId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}

export async function listAssignedStudentIdsForLesson(lessonId: string) {
  const rows = await db.assignment.findMany({
    where: { lessonId },
    select: { studentId: true },
    orderBy: { studentId: "asc" },
  });
  return rows.map((r) => r.studentId);
}

export async function setAssignmentsForLesson(lessonId: string, studentIds: string[]) {
  const ids = Array.from(new Set(studentIds));

  await db.$transaction([
    db.assignment.deleteMany({ where: { lessonId } }),
    ...(ids.length > 0
      ? [
          db.assignment.createMany({
            data: ids.map((studentId) => ({ studentId, lessonId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
}
