"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("lms.logout-button");

type Props = {
  className?: string;
  redirectTo?: string;
};

export function LogoutButton({ className, redirectTo = "/login" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        logger.error("Logout failed", undefined, { data });
      }

      router.replace(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onLogout} loading={loading} className={className}>
      <LogOut />
      {loading ? "Выходим..." : "Выйти"}
    </Button>
  );
}
