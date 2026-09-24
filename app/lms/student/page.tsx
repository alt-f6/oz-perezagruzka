import Link from "next/link";
import { PlayCircle } from "lucide-react";

import { requireRoleForPage } from "@/shared/lib/rbac";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { roleHome } from "@/lms/server/auth/types";
import { db } from "@/shared/lib/db";
import { getAccessibleLessons } from "@/lms/server/student/accessible-lessons";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export default async function StudentDashboard() {
  await requireRoleForPage(["STUDENT"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });
  const user = await requireAuth();

  // Direct assignments + lessons from active course enrollments.
  const lessons = await getAccessibleLessons(user.id);

  const assigned = lessons.length;
  const completed = lessons.filter((l) => l.completedAt).length;
  const inProgress = lessons.filter((l) => l.started && !l.completedAt).length;

  const stats = {
    assigned: String(assigned),
    completed: String(completed),
    in_progress: String(inProgress),
  };

  const continueProgress = await db.lessonProgress.findFirst({
    // Only lessons still open to the student (e.g. not a suspended course).
    where: { studentId: user.id, completedAt: null, lessonId: { in: lessons.map((l) => l.id) } },
    orderBy: { updatedAt: "desc" },
    include: { lesson: true },
  });

  let continueLesson = continueProgress
    ? { id: continueProgress.lesson.id, title: continueProgress.lesson.title, order: continueProgress.lesson.order }
    : undefined;

  if (!continueLesson) {
    const next = lessons.find((l) => !l.completedAt);
    continueLesson = next ? { id: next.id, title: next.title, order: next.order } : undefined;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-3xl font-black tracking-tight">Личный кабинет</h1>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-black tracking-tight">{stats.assigned}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Доступно</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-black tracking-tight text-success">{stats.completed}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Пройдено</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-black tracking-tight text-primary">{stats.in_progress}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">В процессе</p>
          </CardContent>
        </Card>
      </div>

      {continueLesson ? (
        <Card interactive>
          <CardHeader>
            <CardTitle>Продолжить обучение</CardTitle>
            <CardDescription>
              Урок {continueLesson.order}: {continueLesson.title}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/student/lessons/${continueLesson.id}`}>
                <PlayCircle />
                Продолжить
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Добро пожаловать</CardTitle>
            <CardDescription>Пока нет назначенных уроков.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/student/lessons">Перейти к урокам</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
