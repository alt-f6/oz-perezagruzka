import Link from "next/link";

export default function LessonNotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Link
        href="/student/lessons"
        className="mb-4 inline-block text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        ← Назад к урокам
      </Link>
      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <p className="font-bold">Урок не найден</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Урок не существует, скрыт или у вас нет к нему доступа. Обратитесь к куратору, если это ошибка.
        </p>
      </div>
    </main>
  );
}
