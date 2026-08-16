"use client";

import type { ReactNode } from "react";

/**
 * Wraps a legal document with a lightweight "Печать / Сохранить в PDF"
 * action. Consumer-protection law requires that a public offer and privacy
 * policy remain readable, copyable, and printable — this component no
 * longer intercepts copy/print/right-click.
 */
export function ProtectedDocumentViewer({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div className="no-print mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          Скачать / Печать (PDF)
        </button>
      </div>
      {children}
    </div>
  );
}
