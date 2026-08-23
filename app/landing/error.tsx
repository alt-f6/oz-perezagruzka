"use client";

import { useEffect } from "react";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("landing.error");

export default function LandingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Landing route error boundary caught", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-ink-900">
        Что-то пошло не так
      </h1>
      <p className="max-w-md text-ink-600">
        Произошла непредвиденная ошибка при загрузке страницы. Попробуйте обновить страницу — если
        проблема повторится, напишите нам напрямую.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          Попробовать снова
        </button>
        <a
          href="/"
          className="rounded-xl border border-ink-200 px-6 py-3 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          На главную
        </a>
      </div>
    </main>
  );
}
