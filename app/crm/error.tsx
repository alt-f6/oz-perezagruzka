"use client";

import { useEffect } from "react";
import { ErrorState } from "@/crm/components/boundaries/ErrorState";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("crm.root");

export default function CrmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Unhandled error in CRM route tree", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <ErrorState digest={error.digest} onRetry={reset} />
    </div>
  );
}
