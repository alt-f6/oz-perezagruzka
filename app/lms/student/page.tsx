import Link from "next/link";
import { PlayCircle } from "lucide-react";

import { requireRolePage } from "@/lms/server/auth/require-role-page";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { db } from "@/shared/lib/db";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export default async function StudentDashboard() {
  await requireRolePage("STUDENT");
  const user = await requireAuth();

  const assignments = await db.assignment.findMany({
    where: { studentId: user.id, lesson: { isPublished: true } },
    include: { lesson: { include: { progress: { where: { studentId: user.id } } } } },
  });

  const assigned = assignments.length;
  const completed = assignments.filter((a) => a.lesson.progress[0]?.completedAt).length;
  const inProgress = assignments.filter(
    (a) => a.lesson.progress.length > 0 && !a.lesson.progress[0]?.completedAt
  ).length;

  const stats = {
    assigned: String(assigned),
    completed: String(completed),
    in_progress: String(inProgress),
  };

  const continueProgress = await db.lessonProgress.findFirst({
    where: { studentId: user.id, completedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { lesson: true },
  });

  let continueLesson = continueProgress
    ? { id: continueProgress.lesson.id, title: continueProgress.lesson.title, order: continueProgress.lesson.order }
    : undefined;

  if (!continueLesson) {
    const fallbackAssignment = await db.assignment.findFirst({
      where: { studentId: user.id, lesson: { isPublished: true } },
      orderBy: [{ lesson: { order: "asc" } }, { lesson: { id: "asc" } }],
      include: { lesson: true },
    });
    continueLesson = fallbackAssignment
      ? { id: fallbackAssignment.lesson.id, title: fallbackAssignment.lesson.title, order: fallbackAssignment.lesson.order }
      : undefined;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-3xl font-black tracking-tight">Личный кабинет</h1>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-black tracking-tight">{stats.assigned}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Назначено</p>
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
