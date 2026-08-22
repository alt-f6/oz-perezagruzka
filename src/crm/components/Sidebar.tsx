"use client";

import {
  Calendar,
  CalendarDays,
  DollarSign,
  GraduationCap,
  LogOut,
  Users,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/crm/components/ToastProvider";
import { AppSwitcher } from "@/shared/components/AppSwitcher";
import type { Role } from "@/shared/lib/auth";

const NAV_ITEMS: { href: string; label: string; icon: typeof Users; roles: Role[] }[] = [
  { href: "/groups", label: "Группы", icon: Users, roles: ["ADMIN", "MANAGER", "TEACHER"] },
  { href: "/students", label: "Студенты", icon: GraduationCap, roles: ["ADMIN", "MANAGER", "TEACHER"] },
  { href: "/schedule", label: "Расписание", icon: Calendar, roles: ["ADMIN", "MANAGER", "TEACHER"] },
  { href: "/lessons", label: "Занятия", icon: CalendarDays, roles: ["ADMIN", "MANAGER", "TEACHER"] },
  { href: "/salary", label: "Зарплата", icon: DollarSign, roles: ["ADMIN", "MANAGER", "TEACHER"] },
  { href: "/team", label: "Команда", icon: Briefcase, roles: ["ADMIN"] },
];

export function Sidebar({ email, role }: { email: string; role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const showToast = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

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
