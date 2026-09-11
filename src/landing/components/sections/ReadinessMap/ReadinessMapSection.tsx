"use client";

import { Component, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("landing.readiness-map.section");

const ReadinessMapWizard = dynamic(
  () => import("@/landing/components/sections/ReadinessMap/ReadinessMapWizard"),
  { loading: () => <ReadinessMapSkeleton /> },
);

// Mirrors the real wizard card's outer shell (section padding, max width,
// rounded card, header spacing) so swapping the skeleton for the hydrated
// wizard causes as little layout shift as possible.
function ReadinessMapSkeleton() {
  return (
    <div id="readiness-map" className="relative overflow-hidden pt-16 pb-40 md:py-24 scroll-mt-20">
      <div className="relative mx-auto max-w-2xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mx-auto h-6 w-56 animate-pulse rounded-full bg-ink-100" />
          <div className="mx-auto mt-4 h-8 w-full max-w-md animate-pulse rounded-lg bg-ink-100" />
        </div>
        <div className="rounded-3xl border border-rose-100/50 bg-white/90 p-8 sm:p-10 md:p-12 shadow-2xl shadow-brand-900/10">
          <span className="sr-only">Загрузка...</span>
          <div className="mx-auto h-3 w-40 animate-pulse rounded-full bg-ink-100" />
          <div className="mt-8 h-6 w-3/4 animate-pulse rounded-lg bg-ink-100" />
          <div className="mt-8 space-y-4">
            <div className="h-14 w-full animate-pulse rounded-2xl bg-ink-100" />
            <div className="h-14 w-full animate-pulse rounded-2xl bg-ink-100" />
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-ink-100 pt-6">
            <div className="h-11 w-20 animate-pulse rounded-xl bg-ink-100" />
            <div className="h-11 w-32 animate-pulse rounded-2xl bg-ink-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// A failed dynamic-import chunk load (e.g. a stale asset URL after a new
// deploy) throws during render rather than rejecting somewhere catchable, so
// only a class-based error boundary can intercept it - there's no hook
// equivalent. Without this, the section was left frozen on the loading
// skeleton forever with no way for the visitor to recover.
class ReadinessMapErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    logger.error("Не удалось загрузить раздел Карты готовности", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section id="readiness-map" className="relative overflow-hidden py-24 scroll-mt-20">
          <div className="relative mx-auto max-w-lg px-6">
            <div className="rounded-3xl border border-ink-100 bg-white p-8 text-center shadow-xl shadow-ink-900/10">
              <h3 className="text-xl font-bold tracking-tight text-ink-900">
                Не удалось загрузить раздел
              </h3>
              <p className="mt-3 leading-relaxed text-ink-600">
                Проверьте соединение с интернетом и попробуйте обновить страницу.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 min-h-[44px] rounded-2xl bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors duration-200 hover:bg-brand-700"
              >
                Обновить страницу
              </button>
            </div>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

export default function ReadinessMapSection() {
  return (
    <ReadinessMapErrorBoundary>
      <ReadinessMapWizard />
    </ReadinessMapErrorBoundary>
  );
}
