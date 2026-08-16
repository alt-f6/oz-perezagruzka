"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/crm/components/ToastProvider";

export function PortalTopBar({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const showToast = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const res = await fetch("/api/auth/logout", { method: "POST" });

    if (!res.ok) {
      showToast("Не удалось выйти", "error");
      setIsSigningOut(false);
      return;
    }

    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-card">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="btn-ghost shrink-0"
      >
        <LogOut size={16} />
        {isSigningOut ? "Выход..." : "Выйти"}
      </button>
    </div>
  );
}
