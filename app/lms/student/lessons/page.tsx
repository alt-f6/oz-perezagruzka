"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";

type Lesson = {
  id: string;
  title: string;
  description: string;
  order: number;
  completed_at: string | null;
};

export default function StudentLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const r = await fetch("/api/student/lessons", { cache: "no-store" });
        const data = await r.json().catch(() => null);

        if (!alive) return;

        if (!data?.ok) {
          setErr(data?.error || "Ошибка загрузки");
          setLessons([]);
          return;
        }

        setLessons(Array.isArray(data.lessons) ? data.lessons : []);
      } catch {
        if (!alive) return;
        setErr("Ошибка загрузки");
        setLessons([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Личный кабинет</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Уроки</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Здесь только те уроки, которые тебе назначил админ.
          </p>
        </div>

        <Badge variant="outline">{lessons.length} урок(ов)</Badge>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      ) : err ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive-foreground"
        >
          {err}
        </p>
      ) : lessons.length === 0 ? (
        <Card>
          <CardContent className="pt-5">
            <p className="font-bold">Пока нет уроков</p>
            <p className="mt-1 text-sm text-muted-foreground">Админ ещё не выдал тебе доступ.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((l) => {
            const completed = Boolean(l.completed_at);

            return (
              <Link key={l.id} href={`/student/lessons/${l.id}`} className="block">
                <Card interactive className="flex h-full flex-col">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">Урок {l.order}</Badge>
                      {completed ? <Badge variant="success">Пройден</Badge> : null}
                    </div>
                    <CardTitle className="line-clamp-2 text-base">{l.title}</CardTitle>
                    <CardDescription className="line-clamp-3">
                      {l.description || "Без описания"}
                    </CardDescription>
                  </CardHeader>

                  <CardFooter className="mt-auto flex-col items-stretch gap-2">
                    {completed ? <Progress value={100} /> : null}
                  </CardFooter>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
