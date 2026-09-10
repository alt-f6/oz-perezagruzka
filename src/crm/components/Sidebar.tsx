"use client";

import {
  Bot,
  Calendar,
  CalendarDays,
  DollarSign,
  GraduationCap,
  LogOut,
  Users,
  Briefcase,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/crm/components/ToastProvider";
import { AppSwitcher, resolveOrigin } from "@/shared/components/AppSwitcher";
import type { Role } from "@/shared/lib/auth";

const NAV_ITEMS: { href: string; label: string; icon: typeof Users; roles: Role[] }[] = [
  { href: "/groups", label: "Группы", icon: Users, roles: ["ADMIN", "MANAGER", "TEACHER"] },
  { href: "/students", label: "Студенты", icon: GraduationCap, roles: ["ADMIN", "MANAGER", "TEACHER"] },
  { href: "/schedule", label: "Расписание", icon: Calendar, roles: ["ADMIN", "MANAGER", "TEACHER"] },
  { href: "/lessons", label: "Занятия", icon: CalendarDays, roles: ["ADMIN", "MANAGER", "TEACHER"] },
  { href: "/salary", label: "Зарплата", icon: DollarSign, roles: ["ADMIN", "MANAGER"] },
  { href: "/leads", label: "Лиды", icon: TrendingUp, roles: ["ADMIN", "MANAGER"] },
  { href: "/team", label: "Команда", icon: Briefcase, roles: ["ADMIN"] },
];

// The AI tutor is an LMS route (app/lms/admin/tutor), served on a different
// subdomain (lms.<host>) than this CRM sidebar (crm.<host>) -- see
// src/shared/lib/url.ts / AppSwitcher's resolveOrigin. A same-app relative
// href like "/admin/tutor" would resolve against the CRM's own origin and
// 404, so this link's absolute LMS origin is resolved at render time (same
// convention AppSwitcher uses for its cross-app links) and rendered as a
// plain <a> for a full cross-origin navigation, not next/link's <Link>
// (which is for same-app client-side transitions).
//
// resolveOrigin reads window.location, so it returns "" during SSR. Unlike
// AppSwitcher's own cross-app links (which only render inside a dropdown
// opened after hydration, so they never run during SSR), this nav item is
// part of the always-visible list and DOES render server-side. Computing
// tutorHref eagerly would make the server-rendered href a bare
// "/admin/tutor" (wrong CRM-origin path, 404) that then flips to the
// absolute LMS URL after hydration -- a hydration mismatch, and a window
// where a pre-hydration click 404s. So the href is gated behind a
// client-only `mounted` flag: before mount, the link renders with no href
// (identical markup on server and client); once mounted (post-hydration,
// window is always defined), the real absolute href is attached.
const TUTOR_NAV_ITEM = {
  path: "/admin/tutor",
  label: "ИИ-Репетитор",
  icon: Bot,
  roles: ["ADMIN", "TEACHER"] as Role[],
};

export function Sidebar({ email, role }: { email: string; role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const showToast = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const showTutor = TUTOR_NAV_ITEM.roles.includes(role);
  // Only computed/rendered after mount -- see comment above TUTOR_NAV_ITEM.
  const tutorHref = mounted ? `${resolveOrigin("lms")}${TUTOR_NAV_ITEM.path}` : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const res = await fetch("/api/auth/logout", { method: "POST" });

    if (!res.ok) {
      showToast("Не удалось выйти", "error");
      setIsSigningOut(false);
      return;
    }

    router.push("/admin/login");
    router.refresh();
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white">
          OZ
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">Otsek Znaniy</p>
          <p className="truncate text-xs text-slate-500">{email}</p>
        </div>
        <AppSwitcher role={role} />
      </div>

      <div className="mx-5 border-t border-slate-100" />

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <p className="px-3 pb-1.5 pt-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">
          Навигация
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                isActive
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon
                size={17}
                className={`shrink-0 transition-colors ${
                  isActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"
                }`}
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
        {showTutor ? (
          <a
            href={tutorHref}
            aria-disabled={!mounted}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
              mounted
                ? "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                : "cursor-default text-slate-400"
            }`}
          >
            <Bot
              size={17}
              className="shrink-0 text-slate-400 transition-colors group-hover:text-slate-600"
            />
            <span className="truncate">{TUTOR_NAV_ITEM.label}</span>
          </a>
        ) : null}
      </nav>

      <div className="p-3">
        <div className="mx-2 mb-2 border-t border-slate-100" />
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
        >
          <LogOut size={17} className="shrink-0 text-slate-400" />
          {isSigningOut ? "Выход..." : "Выйти"}
        </button>
      </div>
    </aside>
  );
}
