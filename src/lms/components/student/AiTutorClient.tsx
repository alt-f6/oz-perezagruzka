"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useState } from "react";

import type { TutorManifest } from "@/lms/lib/tutor";

type Topic = TutorManifest["topics"][number];

export function AiTutorClient({
  subject,
  blockTitle,
  topics,
}: {
  subject: string;
  blockTitle: string;
  topics: Topic[];
}) {
  const [topicCode, setTopicCode] = useState(topics[0]?.code ?? "1.1");
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Recreated whenever the topic changes so the correct topicCode is sent with
  // every request (and the model swaps to that topic's cached prefix).
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/ai/tutor", body: { topicCode } }),
    [topicCode],
  );

  const { messages, sendMessage, setMessages, status } = useChat({
    transport,
    onError: () => {
      setErrorMessage(
        "Не удалось получить ответ. Проверьте соединение и попробуйте ещё раз через минуту.",
      );
    },
  });

  const isBusy = status === "submitted" || status === "streaming";
  const activeTopic = topics.find((t) => t.code === topicCode);

  const handleTopicChange = (nextCode: string) => {
    if (nextCode === topicCode) return;
    setTopicCode(nextCode);
    // Switching topics starts a fresh conversation.
    setMessages([]);
    setErrorMessage(null);
    setInput("");
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isBusy) return;
    setErrorMessage(null);
    sendMessage({ text: trimmed });
    setInput("");
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          ИИ-репетитор
        </h1>
        <p className="text-sm text-muted-foreground">
          {subject} · {blockTitle}
        </p>
      </header>

      <div className="space-y-1.5">
        <label
          htmlFor="tutor-topic"
          className="block text-sm font-semibold text-foreground"
        >
          Тема
        </label>
        <select
          id="tutor-topic"
          value={topicCode}
          onChange={(e) => handleTopicChange(e.target.value)}
          className="h-10 w-full rounded-md border border-input bg-black/20 px-3 text-sm text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {topics.map((topic) => (
            <option key={topic.code} value={topic.code}>
              {topic.code} — {topic.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-h-[320px] flex-col gap-3 rounded-xl border border-border bg-card/40 p-4">
        {messages.length === 0 ? (
          <div className="m-auto text-center text-sm text-muted-foreground">
            <p className="text-2xl">📘</p>
            <p className="mt-2">
              Задайте вопрос по теме
              {activeTopic ? ` «${activeTopic.title}»` : ""}.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                message.role === "user"
                  ? "ml-auto rounded-tr-none bg-accent text-foreground"
                  : "mr-auto rounded-tl-none border border-border bg-background text-foreground"
              }`}
            >
              {message.parts.map((part, i) =>
                part.type === "text" ? <span key={i}>{part.text}</span> : null,
              )}
            </div>
          ))
        )}

        {status === "submitted" && (
          <div
            className="mr-auto flex items-center gap-1.5 rounded-2xl border border-border bg-background px-4 py-3"
            aria-label="ИИ-репетитор печатает ответ"
          >
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isBusy}
          placeholder="Например: чем истина отличается от заблуждения?"
          className="h-11 flex-1 rounded-md border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="h-11 rounded-md bg-accent px-6 text-sm font-semibold text-foreground transition-colors hover:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
        >
          {isBusy ? "Думаю…" : "Спросить"}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Рядом с ИИ всегда есть живой преподаватель «Перезагрузки».
      </p>
    </div>
  );
}
