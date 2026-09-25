import Link from "next/link";

import { requireAuth } from "@/lms/server/auth/require-auth";
import { getTeacherCourses } from "@/lms/server/teacher-catalog";
import { pluralRu } from "@/lms/lib/admin-format";
import { EmptyState, ExamPill, PageHeader, TagPill } from "@/lms/components/admin/primitives";

export const dynamic = "force-dynamic";

export default async function TeacherCoursesPage() {
  // The layout already gated the role; this just resolves the viewer.
  const user = await requireAuth();
  const courses = await getTeacherCourses(user);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeader
        eyebrow="Кабинет преподавателя"
        title="Мои курсы"
        description="Курсы по предметам ваших групп в CRM и курсы, закреплённые за вами администратором."
      />

      {courses.length === 0 ? (
        <EmptyState
          title="У вас пока нет закрепленных предметов"
          description="Обратитесь к администратору для настройки групп в CRM."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/teacher/courses/${c.id}`}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border-strong hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 font-semibold leading-snug text-foreground">{c.title}</p>
                <ExamPill examType={c.examType} />
              </div>
              <div className="flex flex-wrap gap-1">
                {c.subject ? <TagPill tone="sky">{c.subject}</TagPill> : <TagPill>Предмет не указан</TagPill>}
                {c.grade ? <TagPill>{c.grade} класс</TagPill> : null}
              </div>
              <p className="mt-auto text-xs text-muted-foreground tabular-nums">
                {c.moduleCount} {pluralRu(c.moduleCount, ["модуль", "модуля", "модулей"])} · {c.lessonCount}{" "}
                {pluralRu(c.lessonCount, ["урок", "урока", "уроков"])}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
