"use client";

import { useEffect } from "react";
import { ErrorState } from "@/crm/components/boundaries/ErrorState";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("crm.admin");

export default function AdminSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Unhandled error in admin segment", error, { digest: error.digest });
  }, [error]);

  return <ErrorState digest={error.digest} onRetry={reset} />;
}
