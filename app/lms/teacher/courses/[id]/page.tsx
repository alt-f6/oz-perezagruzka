import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";

import { requireAuth } from "@/lms/server/auth/require-auth";
import { getTeacherCourseOutline } from "@/lms/server/teacher-catalog";
import { EmptyState, ExamPill, PageHeader, Panel, PanelHeader, StatusPill, TagPill } from "@/lms/components/admin/primitives";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TeacherCoursePage({ params }: Props) {
  const user = await requireAuth();
  const { id } = await params;

  // Same 404 for "missing" and "not yours", so scope doesn't leak existence.
  const course = await getTeacherCourseOutline(user, id);
  if (!course) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <Link href="/teacher/courses" className="mb-3 inline-block text-sm font-semibold text-muted-foreground hover:text-foreground">
        ← Мои курсы
      </Link>
      <PageHeader
        title={course.title}
        description={
          <span className="flex flex-wrap items-center gap-1">
            <ExamPill examType={course.examType} />
            {course.subject ? <TagPill tone="sky">{course.subject}</TagPill> : null}
            {course.grade ? <TagPill>{course.grade} класс</TagPill> : null}
          </span>
        }
      />

      {course.modules.length === 0 ? (
        <EmptyState title="В курсе пока нет модулей" />
      ) : (
        <div className="flex flex-col gap-4">
          {course.modules.map((m) => (
            <Panel key={m.id}>
              <PanelHeader title={m.isPublished ? m.title : `${m.title} · черновик`} />
              {m.lessons.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Уроков пока нет.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/teacher/lessons/${l.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
                      >
                        <BookOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{l.title}</span>
                        <StatusPill published={l.isPublished} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
