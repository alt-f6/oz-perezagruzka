import { getSessionUser } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import {
  Users,
  GraduationCap,
  Wallet,
  UserCheck,
  Plus,
  Calendar,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const sessionUser = await getSessionUser();

  const profile = sessionUser
    ? await db.user.findUnique({
        where: { id: sessionUser.id },
        select: { role: true, fullName: true },
      })
    : null;

  const isTeacher = profile?.role === "TEACHER";
  const teacherId = sessionUser?.id ?? "";

  const [studentsCount, groupsCount, lessons] = await Promise.all([
    isTeacher
      ? db.groupStudent
          .findMany({
            where: {
              group: { teacherId, deletedAt: null },
              student: { deletedAt: null },
            },
            select: { studentId: true },
            distinct: ["studentId"],
          })
          .then((rows) => rows.length)
      : db.student.count({ where: { deletedAt: null } }),
    db.group.count({
      where: { deletedAt: null, ...(isTeacher ? { teacherId } : {}) },
    }),
    db.classSession.findMany({
      where: isTeacher ? { teacherId } : undefined,
      select: { id: true, scheduledAt: true, group: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
  ]);

  // Financial aggregates and the sales funnel are for ADMIN/MANAGER only:
  // don't even query them for teachers. DB-side aggregates instead of
  // fetching every transaction/lead row.
  const [revenueAgg, balanceAgg, newLeadsCount, bookedCount] = isTeacher
    ? [null, null, 0, 0]
    : await Promise.all([
        db.transaction.aggregate({
          where: { amount: { gt: 0 } },
          _sum: { amount: true },
        }),
        db.transaction.aggregate({ _sum: { amount: true } }),
        db.lead.count({ where: { status: "NEW" } }),
        db.lead.count({ where: { status: "DIAGNOSTIC_SCHEDULED" } }),
      ]);

  const totalRevenue = Number(revenueAgg?._sum.amount ?? 0);
  const totalBalanceAll = Number(balanceAgg?._sum.amount ?? 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Главный пульт</h1>
          <p className="page-subtitle">
            Добро пожаловать,{" "}
            {profile?.fullName || sessionUser?.email || "Пользователь"}!
            {isTeacher
              ? " Режим преподавателя"
              : " Обзор показателей школы «Перезагрузка»"}
          </p>
        </div>

        {!isTeacher && (
          <div className="flex items-center gap-3">
            <Link href="/students" className="btn-primary">
              <Plus size={16} />
              Новый ученик
            </Link>
            <Link href="/leads" className="btn-secondary">
              <TrendingUp size={16} />
              Лиды ({newLeadsCount})
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-hover flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="overline">Активные ученики</p>
            <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {studentsCount}
            </h3>
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
              <ArrowUpRight size={14} /> База учеников
            </p>
          </div>
          <div className="icon-tile bg-slate-100 text-slate-600">
            <Users size={22} />
          </div>
        </div>

        <div className="card card-hover flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="overline">Учебные группы</p>
            <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              {groupsCount}
            </h3>
            <p className="mt-1.5 text-xs text-slate-500">Потоки ОГЭ</p>
          </div>
          <div className="icon-tile bg-slate-100 text-slate-600">
            <GraduationCap size={22} />
          </div>
        </div>

        {!isTeacher ? (
          <div className="card card-hover flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="overline">Приход / Баланс</p>
              <h3 className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900">
                {totalRevenue.toLocaleString("ru-RU")} ₽
              </h3>
              <p className="mt-1.5 text-xs text-slate-500">
                Общий баланс: {totalBalanceAll.toLocaleString("ru-RU")} ₽
              </p>
            </div>
            <div className="icon-tile bg-emerald-50 text-emerald-600">
              <Wallet size={22} />
            </div>
          </div>
        ) : (
          <div className="card card-hover flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="overline">Мои ученики</p>
              <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {studentsCount}
              </h3>
              <p className="mt-1.5 text-xs text-slate-500">В ведении</p>
            </div>
            <div className="icon-tile bg-slate-100 text-slate-600">
              <UserCheck size={22} />
            </div>
          </div>
        )}

        {!isTeacher && (
          <div className="card card-hover flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="overline">Брони на сентябрь</p>
              <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {bookedCount}
              </h3>
              <p className="mt-1.5 text-xs font-medium text-blue-600">
                Новых заявок: {newLeadsCount}
              </p>
            </div>
            <div className="icon-tile bg-blue-50 text-blue-600">
              <TrendingUp size={22} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Calendar size={16} />
              </span>
              Ближайшие занятия
            </h2>
            <Link
              href="/schedule"
              className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900"
            >
              Все расписание →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {lessons.length > 0 ? (
              lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between gap-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {lesson.group?.name || "Занятие по расписанию"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Дата:{" "}
                      {new Date(lesson.scheduledAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="badge-neutral shrink-0">Урок</span>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-slate-500">
                На ближайшее время уроков не запланировано
              </div>
            )}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="section-title">Быстрые разделы</h2>
          <div className="space-y-2">
            <Link
              href="/students"
              className="group flex items-center justify-between rounded-xl bg-slate-50 p-3.5 text-sm font-medium text-slate-900 transition-all duration-200 hover:bg-slate-100"
            >
              <span>База студентов</span>
              <span className="text-slate-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-900">
                →
              </span>
            </Link>
            <Link
              href="/groups"
              className="group flex items-center justify-between rounded-xl bg-slate-50 p-3.5 text-sm font-medium text-slate-900 transition-all duration-200 hover:bg-slate-100"
            >
              <span>Учебные группы</span>
              <span className="text-slate-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-900">
                →
              </span>
            </Link>
            <Link
              href="/schedule"
              className="group flex items-center justify-between rounded-xl bg-slate-50 p-3.5 text-sm font-medium text-slate-900 transition-all duration-200 hover:bg-slate-100"
            >
              <span>Расписание и слоты</span>
              <span className="text-slate-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-900">
                →
              </span>
            </Link>
            {!isTeacher && (
              <Link
                href="/leads"
                className="group flex items-center justify-between rounded-xl bg-slate-50 p-3.5 text-sm font-medium text-slate-900 transition-all duration-200 hover:bg-slate-100"
              >
                <span>Воронка продаж (Лиды)</span>
                <span className="text-slate-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-900">
                  →
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
