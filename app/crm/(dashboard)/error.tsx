"use client";

import { useEffect } from "react";
import { ErrorState } from "@/crm/components/boundaries/ErrorState";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("crm.dashboard");

export default function DashboardSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Unhandled error in dashboard segment", error, { digest: error.digest });
  }, [error]);

  return <ErrorState digest={error.digest} onRetry={reset} />;
}
