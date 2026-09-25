"use client";

import { useSyncExternalStore } from "react";
import { ArrowUpRight } from "lucide-react";

import { AppSwitcher, resolveOrigin } from "@/shared/components/AppSwitcher";
import type { Role } from "@/shared/lib/auth";
import { NavLink } from "@/lms/components/TopNav";
import { LogoutButton } from "@/lms/components/LogoutButton";

// Teacher workspace header: only the teacher's own sections plus a way back
// to their CRM schedule. Admin tooling (access, settings, billing) is never
// linked from here -- and is route-guarded to ADMIN/MANAGER regardless.

const ITEMS = [
  { href: "/teacher/courses", label: "Мои курсы" },
  { href: "/teacher/tutor", label: "ИИ-Репетитор" },
];

const noopSubscribe = () => () => {};

function CrmLink() {
  // resolveOrigin reads window.location: render only once on the client.
  const crm = useSyncExternalStore(
    noopSubscribe,
    () => resolveOrigin("crm"),
    () => "",
  );
  if (!crm) return null;

  return (
    <a
      href={`${crm}/schedule`}
      className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      Вернуться в CRM
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </a>
  );
}

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function TeacherTopNav({ role, fullName, roleLabel }: { role: Role; fullName: string; roleLabel: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/40 px-5 py-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-4">
        <AppSwitcher role={role} className="text-muted-foreground" />
        <nav aria-label="Кабинет преподавателя" className="flex flex-wrap gap-1">
          {ITEMS.map((x) => (
            <NavLink key={x.href} href={x.href} label={x.label} />
          ))}
          <CrmLink />
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
          >
            {initials(fullName) || "?"}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-foreground">{fullName}</span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{roleLabel}</span>
          </span>
        </div>
        <LogoutButton redirectTo="/login" />
      </div>
    </header>
  );
}
