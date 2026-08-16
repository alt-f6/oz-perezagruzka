"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/shared/components/ui/button";

export default function CreateLessonButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function createLesson() {
    if (loading) return;
    setLoading(true);
    setError(null);

    const r = await fetch("/api/admin/lessons", { method: "POST" });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok || !j?.lesson?.id) {
      setLoading(false);
      setError(j?.error || "Не удалось создать урок");
      return;
    }

    router.push(`/admin/lessons/${j.lesson.id}`);
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button type="button" onClick={createLesson} loading={loading}>
        {loading ? "Создаю..." : "Создать урок"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs font-semibold text-destructive-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
