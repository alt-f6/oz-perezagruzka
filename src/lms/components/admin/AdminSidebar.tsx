"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  Menu,
  MessageSquare,
  Sparkles,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { buildAppLinks } from "@/shared/components/AppSwitcher";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/components/ui/sheet";
import type { Role } from "@/shared/lib/auth";
import { cn } from "@/shared/lib/utils";
import { LogoutButton } from "@/lms/components/LogoutButton";

export type AdminNavKey = "overview" | "courses" | "lessons" | "students" | "access" | "messages" | "tutor";

type NavItem = { key: AdminNavKey; href: string; label: string; icon: LucideIcon; exact?: boolean; also?: string[] };

const NAV: Record<AdminNavKey, NavItem> = {
  overview: { key: "overview", href: "/admin", label: "Обзор", icon: LayoutDashboard, exact: true },
  courses: { key: "courses", href: "/admin/courses", label: "Курсы", icon: Library },
  lessons: { key: "lessons", href: "/admin/lessons", label: "Уроки", icon: BookOpen },
  students: { key: "students", href: "/admin/students", label: "Ученики", icon: Users },
  access: { key: "access", href: "/admin/access", label: "Доступ", icon: UserCheck, also: ["/admin/assignments"] },
  messages: { key: "messages", href: "/admin/messages", label: "Вопросы", icon: MessageSquare },
  tutor: { key: "tutor", href: "/admin/tutor", label: "ИИ-репетитор", icon: Sparkles },
};

type Props = {
  role: Role;
  roleLabel: string;
  items: AdminNavKey[];
  /** Unanswered student questions, shown as a badge on "Вопросы". */
  unansweredCount: number;
};

function useIsActive() {
  const pathname = usePathname();
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  return (item: NavItem) => (item.exact ? pathname === item.href : matches(item.href) || (item.also ?? []).some(matches));
}

function Brand({ roleLabel }: { roleLabel: string }) {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <GraduationCap className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-sm font-bold tracking-tight text-foreground">Перезагрузка</span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">LMS · {roleLabel}</span>
      </span>
    </Link>
  );
}

function NavList({
  items,
  unansweredCount,
  onNavigate,
}: {
  items: AdminNavKey[];
  unansweredCount: number;
  onNavigate?: () => void;
}) {
  const isActive = useIsActive();

  return (
    <nav aria-label="Разделы LMS" className="flex flex-col gap-0.5">
      {items.map((key) => {
        const item = NAV[key];
        const active = isActive(item);
        const Icon = item.icon;
        const badge = key === "messages" && unansweredCount > 0 ? unansweredCount : null;

        return (
          <Link
            key={key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {active ? (
              <span aria-hidden="true" className="absolute inset-y-1.5 -left-3 w-0.5 rounded-full bg-primary" />
            ) : null}
            <Icon
              className={cn("size-4 shrink-0", active ? "text-primary-2" : "text-muted-foreground group-hover:text-foreground")}
              aria-hidden="true"
            />
            <span className="truncate">{item.label}</span>
            {badge !== null ? (
              <span
                className="ml-auto min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-primary-foreground tabular-nums"
                aria-label={`${badge} без ответа`}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

const noopSubscribe = () => () => {};

function OtherApps({ role }: { role: Role }) {
  // buildAppLinks reads window.location, so render nothing on the server and
  // during hydration, then the real links on the client.
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!isClient) return null;

  const links = buildAppLinks(role).filter((l) => !l.label.startsWith("LMS"));
  if (links.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Другие разделы</p>
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          className="flex h-8 items-center justify-between gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="truncate">{l.label}</span>
          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

function SidebarBody(props: Props & { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6">
      <Brand roleLabel={props.roleLabel} />
      <NavList items={props.items} unansweredCount={props.unansweredCount} onNavigate={props.onNavigate} />
      <div className="mt-auto flex flex-col gap-4">
        <OtherApps role={props.role} />
        <LogoutButton redirectTo="/login" className="w-full justify-start" />
      </div>
    </div>
  );
}

export function AdminSidebar(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: fixed rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-background px-3 py-4 lg:block">
        <SidebarBody {...props} />
      </aside>

      {/* Tablet / mobile: top bar + slide-over */}
      <header
        className="sticky z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden"
        style={{ top: 0 }}
      >
        <Brand roleLabel={props.roleLabel} />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="relative flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Открыть меню"
          >
            <Menu className="size-4" />
            {props.unansweredCount > 0 ? (
              <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary" aria-hidden="true" />
            ) : null}
          </SheetTrigger>
          <SheetContent side="left" className="w-72 max-w-[85vw] bg-background px-3 py-4">
            <SheetTitle className="sr-only">Меню LMS</SheetTitle>
            <SidebarBody {...props} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
