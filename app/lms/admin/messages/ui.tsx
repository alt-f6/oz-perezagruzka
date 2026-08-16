"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Textarea } from "@/shared/components/ui/textarea";
import type { Role } from "@/lms/server/auth/types";

type Message = {
  id: string;
  text: string;
  sender_role: Role;
  created_at: string;
  lesson_title: string | null;
  student_email: string;
};

export default function AdminMessagesClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  async function load() {
    const r = await fetch("/api/admin/messages");
    const data = await r.json();
    if (r.ok && data?.ok) {
      setMessages(data.messages ?? []);
    }
  }

  useEffect(() => {
    load()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function answerMessage(id: string) {
    const answerText = answers[id]?.trim();
    if (!answerText) return;
    setBusyId(id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/messages/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answerText }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        setError(data?.error || "Не удалось сохранить ответ");
        return;
      }
      setAnswers((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (err: any) {
      setError(err?.message || "Сетевая ошибка");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-3xl font-black tracking-tight">Сообщения</h1>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      ) : (
        <>
          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive-foreground"
            >
              {error}
            </p>
          ) : null}

          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Сообщений нет.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <Card key={m.id}>
                  <CardContent className="pt-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>#{m.id}</span>
                      <span>{m.student_email}</span>
                      <span>{m.lesson_title ? `Урок: ${m.lesson_title}` : "Без урока"}</span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                      <Badge variant={m.sender_role === "STUDENT" ? "default" : "success"}>
                        {m.sender_role === "STUDENT" ? "Вопрос" : "Ответ"}
                      </Badge>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm">{m.text}</p>

                    {m.sender_role === "STUDENT" ? (
                      <div className="mt-3 flex flex-col gap-2">
                        <Textarea
                          rows={3}
                          value={answers[m.id] ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [m.id]: e.target.value }))}
                          placeholder="Введите ответ"
                        />
                        <Button
                          size="sm"
                          className="self-start"
                          onClick={() => answerMessage(m.id)}
                          disabled={!(answers[m.id] ?? "").trim()}
                          loading={busyId === m.id}
                        >
                          {busyId === m.id ? "Сохраняем..." : "Ответить"}
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
