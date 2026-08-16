"use client";

import { useState } from "react";
import { NAV_LINKS } from "@/landing/lib/navigation";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <a
          href="#top"
          className="text-lg font-extrabold tracking-tight text-ink-900 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          Перезагрузка
        </a>

        <nav aria-label="Основная навигация" className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded text-sm font-semibold text-ink-600 transition hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href="#readiness-map"
          className="hidden rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-bold text-ink-900 shadow-md shadow-accent-500/25 transition-shadow hover:shadow-lg hover:shadow-accent-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 md:inline-block"
        >
          Собрать Карту готовности
        </a>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-100 bg-ink-50 text-ink-700 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
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
              onClick={() => setOpen(false)}
              className="mt-2 min-h-[44px] rounded-xl bg-accent-500 px-4 py-3 text-center text-sm font-bold text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300"
            >
              Собрать Карту готовности
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
