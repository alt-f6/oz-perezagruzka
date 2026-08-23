"use client";

import { LayoutGrid } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Role } from "@/shared/lib/auth";
import { cn } from "@/shared/lib/utils";

type AppTarget = "landing" | "crm" | "lms";

type AppLink = {
  label: string;
  description: string;
  href: string;
};

const ENV_FALLBACKS: Record<AppTarget, string | undefined> = {
  landing: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL,
  crm: process.env.NEXT_PUBLIC_CRM_URL,
  lms: process.env.NEXT_PUBLIC_LMS_URL,
};

const DEFAULT_ORIGINS: Record<AppTarget, string> = {
  landing: "http://localhost:3000",
  crm: "http://crm.localhost:3000",
  lms: "http://lms.localhost:3000",
};

/**
 * Mirrors src/shared/lib/url.ts's resolveOrigin, but runs client-side off
 * window.location since AppSwitcher renders inside client nav components.
 * Subdomain cookies are host-only (no Domain attribute is set when signing
 * in), so swapping crm./lms. via a plain link never touches the other
 * app's session cookie.
 */
function resolveOrigin(app: AppTarget): string {
  if (typeof window === "undefined") return "";

  const { hostname, port } = window.location;
  const isLocal = hostname.includes("localhost") || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);

  if (isLocal) {
    const rootHostname = hostname.replace(/^(crm|lms)\./, "");
    const targetHostname = app === "landing" ? rootHostname : `${app}.${rootHostname}`;
    const targetHost = port ? `${targetHostname}:${port}` : targetHostname;
    return `${window.location.protocol}//${targetHost}`;
  }

  if (ENV_FALLBACKS[app]) return ENV_FALLBACKS[app] as string;

  const rootHostname = hostname.replace(/^(crm|lms)\./, "");
  const targetHostname = app === "landing" ? rootHostname : `${app}.${rootHostname}`;
  return `https://${targetHostname}`;
}

export function buildAppLinks(role: Role): AppLink[] {
  const landing = resolveOrigin("landing") || DEFAULT_ORIGINS.landing;
  const crm = resolveOrigin("crm") || DEFAULT_ORIGINS.crm;
  const lms = resolveOrigin("lms") || DEFAULT_ORIGINS.lms;

  switch (role) {
    case "ADMIN":
    case "MANAGER":
      return [
        { label: "Главный сайт", description: "Лендинг и маркетинг", href: landing },
        { label: "CRM Управление", description: "Группы, лиды, зарплаты", href: crm },
        { label: "LMS Учебный портал", description: "Курсы и материалы", href: lms },
      ];
    case "TEACHER":
      return [
        { label: "LMS Портал / Мои курсы", description: "Учебные материалы", href: lms },
        { label: "Мое расписание", description: "Занятия и группы", href: `${crm}/schedule` },
        { label: "Главный сайт", description: "Лендинг и маркетинг", href: landing },
      ];
    case "STUDENT":
      return [
        { label: "LMS Личный кабинет", description: "Курсы и задания", href: lms },
        { label: "Главный сайт", description: "Лендинг и маркетинг", href: landing },
      ];
    default:
      return [{ label: "Главный сайт", description: "Лендинг и маркетинг", href: landing }];
  }
}

export function AppSwitcher({ role, className }: { role: Role; className?: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const links = buildAppLinks(role);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Переключить приложение"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
      >
        <LayoutGrid size={18} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg"
        >
          <p className="px-3.5 pb-1.5 pt-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-400">
            Приложения
          </p>
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex flex-col gap-0.5 px-3.5 py-2 text-sm transition-colors duration-150 hover:bg-slate-50"
            >
              <span className="font-medium text-slate-900">{link.label}</span>
              <span className="text-xs text-slate-500">{link.description}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
