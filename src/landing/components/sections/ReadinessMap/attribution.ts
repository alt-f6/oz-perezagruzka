"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Utm } from "@/landing/lib/validations/readiness";
import { getOrCreateSessionId } from "@/landing/lib/session-id";

export function useAttribution(): { sessionId: string; utm: Utm } {
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    const initSession = async () => {
      const id = await getOrCreateSessionId();
      if (id) {
        setSessionId(id);
      }
    };

    initSession();
  }, []);

  const utm: Utm = {
    utmSource: searchParams.get("utm_source") ?? undefined,
    utmMedium: searchParams.get("utm_medium") ?? undefined,
    utmCampaign: searchParams.get("utm_campaign") ?? undefined,
    utmContent: searchParams.get("utm_content") ?? undefined,
    utmTerm: searchParams.get("utm_term") ?? undefined,
    clickId:
      searchParams.get("click_id") ??
      searchParams.get("gclid") ??
      searchParams.get("fbclid") ??
      undefined,
    referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
    landingPage: typeof window !== "undefined" ? window.location.pathname : undefined,
  };

  return { sessionId, utm };
}
