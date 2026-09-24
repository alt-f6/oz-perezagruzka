import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Clock,
  HardDrive,
  Library,
  MessageSquare,
  Plus,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

import { requireRoleForPage } from "@/shared/lib/rbac";
import { roleHome } from "@/lms/server/auth/types";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import {
  getCourseSummaries,
  getDashboardStats,
  getRecentLessons,
  isCatalogEditor,
} from "@/lms/server/admin/catalog";
import { formatBytes, formatRelativeRu, pluralRu } from "@/lms/lib/admin-format";
import {
  EmptyState,
  ExamPill,
  KpiCard,
  PageHeader,
  Panel,
  PanelHeader,
  RatioBar,
  StatusPill,
  TagPill,
} from "@/lms/components/admin/primitives";
import CreateLessonButton from "./lessons/CreateLessonButton";

export const dynamic = "force-dynamic";

function greeting(now: Date): string {
  const hour = Number(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Europe/Moscow" }));
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

export default async function AdminHomePage() {
  const user = await requireRoleForPage(["ADMIN", "MANAGER", "TEACHER"], {
    adminBypass: true,
    loginPath: "/login",
    forbiddenPath: (user) => roleHome(user.role),
  });

  const editor = isCatalogEditor(user);
  const now = new Date();

  const [stats, recent, courses] = await Promise.all([
    getDashboardStats(user, now),
    getRecentLessons(user),
    getCourseSummaries(user),
  ]);

  const today = now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Moscow" });

  const attention = [
    stats.lessons.empty > 0 && {
      icon: AlertTriangle,
      tone: "warning" as const,
      text: `${stats.lessons.empty} ${pluralRu(stats.lessons.empty, ["урок", "урока", "уроков"])} без материалов`,
      href: "/admin/lessons?status=empty",
    },
    stats.staleDrafts > 0 && {
      icon: Clock,
      tone: "muted" as const,
      text: `${stats.staleDrafts} ${pluralRu(stats.staleDrafts, ["черновик", "черновика", "черновиков"])} старше 30 дней`,
      href: "/admin/lessons?status=draft",
    },
    editor &&
      stats.unanswered.count > 0 && {
        icon: MessageSquare,
        tone: "primary" as const,
        text: `${stats.unanswered.count} ${pluralRu(stats.unanswered.count, ["вопрос", "вопроса", "вопросов"])} без ответа`,
        href: "/admin/messages",
      },
  ].filter(Boolean) as { icon: typeof Clock; tone: "warning" | "muted" | "primary"; text: string; href: string }[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={today}
        title={greeting(now)}
        description={editor ? "Сводка по учебному порталу за последние 7 дней." : "Ваши курсы и материалы."}
        actions={
          editor ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/courses">
                  <Library />
                  Курсы
                </Link>
              </Button>
              <CreateLessonButton />
            </>
          ) : null
        }
      />

      {/* KPIs: the three numbers leadership asked to see first. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          accent
          label="Активные ученики"
          icon={Users}
          value={stats.activeStudents7d}
          caption={
            <>
              за 7 дней · из {stats.totalStudents}{" "}
              {pluralRu(stats.totalStudents, ["ученика", "учеников", "учеников"])}
              {editor ? "" : " на ваших курсах"}
            </>
          }
          footer={
            <RatioBar value={stats.activeStudents7d} total={stats.totalStudents} label="Доля активных учеников" />
          }
        />

        <KpiCard
          label="Уроки"
          icon={BookOpen}
          value={stats.lessons.total}
          caption={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                {stats.lessons.published} опубликовано
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-muted-foreground/60" aria-hidden="true" />
                {stats.lessons.draft} {pluralRu(stats.lessons.draft, ["черновик", "черновика", "черновиков"])}
              </span>
            </span>
          }
          footer={<RatioBar value={stats.lessons.published} total={stats.lessons.total} label="Доля опубликованных" />}
        />

        <KpiCard
          label="Вопросы без ответа"
          icon={MessageSquare}
          value={stats.unanswered.count}
          caption={
            stats.unanswered.oldestAt
              ? `самый старый — ${formatRelativeRu(stats.unanswered.oldestAt, now)}`
              : "на все вопросы учеников ответили"
          }
          footer={
            editor && stats.unanswered.count > 0 ? (
              <Link
                href="/admin/messages"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary-2 hover:underline"
              >
                Открыть вопросы <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null
          }
        />
      </div>

      {editor ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { href: "/admin/lessons", label: "Все уроки", icon: BookOpen },
            { href: "/admin/courses", label: "Курсы и предметы", icon: Library },
            ...(user.role === "ADMIN"
              ? [
                  { href: "/admin/assignments", label: "Открыть доступ", icon: UserCheck },
                  { href: "/admin/tutor", label: "ИИ-репетитор", icon: Sparkles },
                ]
              : [{ href: "/admin/messages", label: "Вопросы учеников", icon: MessageSquare }]),
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <a.icon className="size-4 text-muted-foreground group-hover:text-primary-2" aria-hidden="true" />
              <span className="truncate">{a.label}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <PanelHeader
            title="Недавно изменённые"
            action={
              <Link href="/admin/lessons" className="text-xs font-medium text-muted-foreground hover:text-foreground">
                Все уроки →
              </Link>
            }
          />
          {recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Уроков пока нет.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((l) => (
                <li key={l.id}>
                  <Link
                    href={editor ? `/admin/lessons/${l.id}` : `/student/lessons/${l.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <BookOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{l.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {l.isUncategorized ? "Без курса" : l.courseTitle}
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <StatusPill published={l.isPublished} />
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                      {formatRelativeRu(l.updatedAt, now)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader title="Требует внимания" />
          <ul className="flex flex-col gap-1 p-2">
            {attention.length === 0 ? (
              <li className="px-2 py-6 text-center text-sm text-muted-foreground">Всё в порядке 🎉</li>
            ) : (
              attention.map((a) => (
                <li key={a.text}>
                  <Link
                    href={a.href}
                    className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent/60"
                  >
                    <a.icon
                      className={cn(
                        "size-4 shrink-0",
                        a.tone === "warning" && "text-warning",
                        a.tone === "muted" && "text-muted-foreground",
                        a.tone === "primary" && "text-primary-2",
                      )}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-foreground">{a.text}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))
            )}
            <li className="mt-1 flex items-center gap-3 border-t border-border px-2 pt-3 pb-1 text-sm text-muted-foreground">
              <HardDrive className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">Медиатека (PDF, аудио)</span>
              <span className="tabular-nums text-foreground">{formatBytes(stats.storageBytes)}</span>
            </li>
          </ul>
        </Panel>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {editor ? "Курсы" : "Мои курсы"}
          </h2>
          {editor ? (
            <Link href="/admin/courses" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Управление →
            </Link>
          ) : null}
        </div>

        {courses.length === 0 ? (
          <EmptyState
            title={editor ? "Курсов пока нет" : "За вами пока не закреплено ни одного курса"}
            description={editor ? "Создайте курс, чтобы сгруппировать уроки по предмету и экзамену." : "Попросите администратора назначить вас преподавателем курса."}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((c) => (
              <Link
                key={c.id}
                href={`/admin/lessons?course=${c.id}`}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-border-strong hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  c.isUncategorized ? "border-dashed border-warning/40" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold leading-snug text-foreground">
                    {c.isUncategorized ? "Без курса / Неразобранное" : c.title}
                  </p>
                  <ExamPill examType={c.examType} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.isUncategorized ? <TagPill tone="warning">Нужно разложить по курсам</TagPill> : null}
                  {c.subject ? <TagPill tone="sky">{c.subject}</TagPill> : null}
                  {c.grade ? <TagPill>{c.grade} класс</TagPill> : null}
                  {!c.isUncategorized && !c.subject && !c.examType ? <TagPill>Предмет не указан</TagPill> : null}
                </div>
                <div className="mt-auto flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>
                      {c.lessonCount} {pluralRu(c.lessonCount, ["урок", "урока", "уроков"])} · {c.moduleCount}{" "}
                      {pluralRu(c.moduleCount, ["модуль", "модуля", "модулей"])}
                    </span>
                    <span>
                      {c.activeEnrollments} {pluralRu(c.activeEnrollments, ["ученик", "ученика", "учеников"])}
                    </span>
                  </div>
                  <RatioBar value={c.publishedLessonCount} total={c.lessonCount} label="Опубликовано уроков" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
