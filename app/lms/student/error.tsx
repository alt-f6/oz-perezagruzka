"use client";

import { useEffect } from "react";
import { ErrorState } from "@/lms/components/boundaries/ErrorState";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("lms.student");

export default function LmsStudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Unhandled error in LMS student segment", error, { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <ErrorState digest={error.digest} onRetry={reset} />
    </main>
  );
}
