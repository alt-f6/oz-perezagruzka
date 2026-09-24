import Link from "next/link";

import { requireRoleForPage } from "@/shared/lib/rbac";
import { roleHome } from "@/lms/server/auth/types";
import { cn } from "@/shared/lib/utils";
import { pluralRu } from "@/lms/lib/admin-format";
import { getAccessCourses, getCourseRoster, getGroupOptions, getStudentOptions } from "@/lms/server/admin/access";
import { EmptyState, ExamPill, PageHeader } from "@/lms/components/admin/primitives";

import { AccessTabs } from "./AccessTabs";
import { CoursePicker } from "./CoursePicker";
import { AccessRoster } from "./AccessRoster";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminAccessPage({ searchParams }: Props) {
  await requireRoleForPage(["ADMIN"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });

  const params = await searchParams;
  const requested = Array.isArray(params.course) ? params.course[0] : params.course;

  const courses = await getAccessCourses();
  const selected = courses.find((c) => c.id === requested) ?? courses[0] ?? null;

  const [roster, groups, students] = selected
    ? await Promise.all([getCourseRoster(selected.id), getGroupOptions(), getStudentOptions()])
    : [null, [], []];

  return (
    <div>
      <PageHeader
        eyebrow="Ученики"
        title="Доступ"
        description="Запись на курсы и абонемент по месяцам: ученик видит только оплаченные модули курса. Отдельные уроки можно открыть во вкладке «Отдельные уроки»."
      />
      <AccessTabs active="courses" />

      {courses.length === 0 ? (
        <EmptyState
          title="Курсов пока нет"
          description="Создайте курс в разделе «Курсы», затем возвращайтесь сюда, чтобы записать учеников."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="lg:hidden">
            <CoursePicker courses={courses.map((c) => ({ id: c.id, title: c.title }))} value={selected?.id ?? ""} />
          </div>

          <nav aria-label="Курсы" className="hidden flex-col gap-0.5 self-start rounded-lg border border-border bg-card p-1.5 lg:flex">
            {courses.map((c) => {
              const active = c.id === selected?.id;
              return (
                <Link
                  key={c.id}
                  href={`/admin/access?course=${c.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 font-medium leading-snug">{c.title}</span>
                    <ExamPill examType={c.examType} />
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.activeCount} {pluralRu(c.activeCount, ["ученик", "ученика", "учеников"])} · {c.moduleCount}{" "}
                    {pluralRu(c.moduleCount, ["модуль", "модуля", "модулей"])}
                  </span>
                </Link>
              );
            })}
          </nav>

          {roster ? (
            <AccessRoster key={roster.course.id} roster={roster} groups={groups} students={students} />
          ) : null}
        </div>
      )}
    </div>
  );
}
