"use client";

import { useState } from "react";
import { NAV_LINKS } from "@/landing/lib/navigation";
import { reachGoal } from "@/landing/lib/analytics";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 shadow-xs backdrop-blur-xl transition-all">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <a
          href="#top"
          className="shrink-0 rounded text-xl font-black tracking-tight text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:text-2xl"
        >
          Перезагрузка
        </a>

        <nav aria-label="Основная навигация" className="hidden items-center gap-6 md:flex lg:gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded text-sm font-bold text-slate-700 transition-colors hover:text-[#0055FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 lg:text-base"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#readiness-map"
          onClick={() => reachGoal("cta_analysis_click")}
          className="group relative hidden min-h-[48px] items-center justify-center overflow-hidden whitespace-nowrap rounded-2xl border border-white/20 bg-gradient-to-r from-[#0055FF] via-[#004AE6] to-[#003BBF] px-6 py-3 text-sm font-extrabold tracking-tight text-white shadow-lg shadow-[#0055FF]/30 transition-all duration-300 after:absolute after:inset-x-0 after:top-0 after:h-[1px] after:rounded-t-2xl after:bg-white/40 hover:shadow-xl hover:shadow-[#0055FF]/45 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:inline-flex sm:text-base"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-all duration-700 group-hover:left-full"
          />
          <span className="relative">Записаться на бесплатный разбор</span>
        </a>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ink-100 bg-ink-50 text-ink-700 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* CSS grid-template-rows 0fr->1fr trick: animates a track size rather
          than the `height` property, so the browser can composite it without
          the reflow/layout-thrash a `height: 0 -> "auto"` animation causes. */}
      <div
        id="mobile-nav"
        aria-label="Мобильная навигация"
        inert={!open ? true : undefined}
        className={`grid overflow-hidden border-t border-ink-100 bg-white transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none md:hidden ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        } transition-opacity`}
      >
        <nav className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-1 px-6 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="min-h-[44px] rounded-lg px-2 py-2.5 text-base font-semibold text-ink-700 transition hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#readiness-map"
              onClick={() => {
                setOpen(false);
                reachGoal("cta_analysis_click");
              }}
              className="mt-2 flex min-h-[60px] items-center justify-center rounded-xl bg-[#0055FF] px-4 text-center text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              Записаться на бесплатный разбор
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
