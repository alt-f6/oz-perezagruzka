import { db } from "@/shared/lib/db";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { parseLessonListFilters } from "@/crm/lib/lessonFilters";
import { listLessonsPage } from "@/crm/lib/services/lesson-list.service";
import { sortByRu } from "@/shared/lib/sortRu";
import { LessonsClient } from "./LessonsClient";

export default async function LessonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const sessionUser = await requireRoleForPage(["ADMIN", "MANAGER", "TEACHER"], {
    loginPath: "/admin/login",
    forbiddenPath: () => "/access-denied",
  });
  const isTeacher = sessionUser.role === "TEACHER";

  const parsed = parseLessonListFilters(sp);
  const filters = isTeacher ? { ...parsed, teacherId: undefined } : parsed;

  const [{ lessons, total, page, pageSize }, groupsRaw, teachersRaw, studentsRaw] = await Promise.all([
    listLessonsPage({ sessionUser, filters }),
    db.group.findMany({
      where: isTeacher ? { teacherId: sessionUser.id } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true, teacherId: true },
    }),
    db.user.findMany({
      where: isTeacher ? { role: "TEACHER", id: sessionUser.id } : { role: "TEACHER" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    isTeacher
      ? Promise.resolve([])
      : db.student.findMany({
          where: { deletedAt: null },
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true },
        }),
  ]);
  const groups = sortByRu(groupsRaw, (g) => g.name);
  const teachers = sortByRu(teachersRaw, (t) => t.fullName);
  const students = sortByRu(studentsRaw, (s) => s.fullName);

  return (
    <LessonsClient
      initialLessons={lessons}
      initialTotal={total}
      initialFilters={{ ...filters, page, pageSize }}
      groups={groups}
      teachers={teachers}
      students={students}
      userRole={sessionUser.role}
    />
  );
}
