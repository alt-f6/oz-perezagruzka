"use client";

import { Component, type ReactNode } from "react";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("lms.media-error-boundary");

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean };

export class MediaErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    logger.error("lesson media render error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive-foreground">
            Не удалось отобразить материал урока.
          </div>
        )
      );
    }

    return this.props.children;
  }
}
