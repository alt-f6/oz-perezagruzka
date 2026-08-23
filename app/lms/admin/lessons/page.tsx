import Link from "next/link";

import { db } from "@/shared/lib/db";
import { requireRoleForPage } from "@/shared/lib/rbac";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";

import CreateLessonButton from "./CreateLessonButton";

export default async function AdminLessonsPage() {
  await requireRoleForPage(["ADMIN", "MANAGER"], { adminBypass: true, loginPath: "/login" });

  const lessons = await db.lesson.findMany({
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });

  const publishedCount = lessons.filter((x) => x.isPublished).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Админ панель
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Уроки</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Список всех уроков, их порядок и опубликованность.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <CreateLessonButton />
          <Badge variant="outline">{lessons.length} всего</Badge>
          <Badge variant="success">{publishedCount} опубликовано</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/assignments">Назначения</Link>
          </Button>
        </div>
      </div>

      {lessons.length === 0 ? (
        <Card>
          <CardContent className="pt-5">
            <p className="font-bold">Уроков пока нет</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Добавь уроки через seed или создай первый через кнопку выше.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Order</TableHead>
              <TableHead>Урок</TableHead>
              <TableHead className="w-40">Статус</TableHead>
              <TableHead className="w-64 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-muted-foreground">{l.order ?? 0}</TableCell>

                <TableCell>
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-bold">{l.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">ID: {l.id}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {l.description || "Описание не заполнено"}
                  </p>
                </TableCell>

                <TableCell>
                  {l.isPublished ? (
                    <Badge variant="success">Опубликован</Badge>
                  ) : (
                    <Badge variant="secondary">Черновик</Badge>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/lessons/${l.id}`}>Редактировать</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/assignments?lessonId=${l.id}`} title="Назначить этот урок ученикам">
                        Назначить
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
