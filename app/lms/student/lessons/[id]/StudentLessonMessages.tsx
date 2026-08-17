"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Textarea } from "@/shared/components/ui/textarea";
import type { Role } from "@/lms/server/auth/types";

type Message = {
  id: number;
  text: string;
  sender_role: Role;
  created_at: string;
  lesson_title: string | null;
};

export function StudentLessonMessages({ lessonId }: { lessonId: string }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);

    const r = await fetch(`/api/student/messages?lessonId=${lessonId}`);
    const data = await r.json().catch(() => null);

    if (!r.ok || !data?.ok) {
      setMessages([]);
      setError(data?.error || `load_failed_${r.status}`);
      return;
    }

    setMessages(data.messages ?? []);
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const r = await fetch("/api/student/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lessonId }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        setError(data?.error || "Не удалось отправить сообщение");
        return;
      }
      setText("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сетевая ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Задать вопрос</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Опишите вопрос по уроку"
            rows={4}
            maxLength={2000}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={!text.trim()} loading={busy} className="self-start">
              {busy ? "Отправляем..." : "Отправить"}
            </Button>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-destructive-foreground">
                {error}
              </p>
            ) : null}
          </div>
        </form>

        <p className="mt-6 mb-3 text-sm font-bold">История сообщений</p>

        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет сообщений по этому уроку.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div key={m.id} className="rounded-2xl border border-border bg-black/10 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>#{m.id}</span>
                  <Badge variant={m.sender_role === "STUDENT" ? "default" : "success"}>
                    {m.sender_role === "STUDENT" ? "Вопрос" : "Ответ"}
                  </Badge>
                  <span>{new Date(m.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{m.text}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
