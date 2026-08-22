"use client";

import { useMemo, useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { getOrCreateSessionId } from "@/landing/lib/session-id";

const MAX_USER_MESSAGES = 3;

const QUICK_PROMPTS = [
  "Объясни теорему Пифагора простыми словами",
  "Как решать 22 задачу ОГЭ по математике?",
  "Разбери ошибки в сочинении 9.3",
];

const STATUS_BADGES = [
  { icon: "⚡", label: "Отвечает за 1.5 секунды" },
  { icon: "🎯", label: "База задач ОГЭ и ЕГЭ 2026" },
];

export default function AITutor() {
  const [input, setInput] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    const id = getOrCreateSessionId();

    const timer = setTimeout(() => {
      setSessionId(id);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/ai/chat", body: { sessionId } }),
    [sessionId],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (error) => {
      const isRateLimitError = (() => {
        try {
          const parsed = JSON.parse(error.message);
          return parsed?.code === "RATE_LIMITED";
        } catch {
          return false;
        }
      })();

      if (isRateLimitError) {
        setLimitReached(true);
      } else {
        setServerErrorMessage(
          "Не удалось получить ответ — похоже, проблема на сервере или с сетью. Попробуйте задать вопрос ещё раз через минуту.",
        );
      }
    },
  });

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const reachedLimit = limitReached || userMessageCount >= MAX_USER_MESSAGES;
  const isBusy = status === "submitted" || status === "streaming";

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || reachedLimit || isBusy) return;
    setServerErrorMessage(null);
    sendMessage({ text: trimmed });
    setInput("");
  };

  const handlePromptClick = (prompt: string) => {
    if (reachedLimit || isBusy) return;
    setInput(prompt);
  };

  return (
    <div className="relative overflow-hidden py-20 md:py-28">
      <div className="pointer-events-none absolute -top-24 left-1/4 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-300/25 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 -z-10 h-96 w-96 translate-x-1/2 rounded-full bg-accent-300/20 blur-[110px]" />
      <div className="pointer-events-none absolute top-1/3 right-1/3 -z-10 h-72 w-72 rounded-full bg-purple-300/15 blur-[100px]" />

      <div className="mx-auto mb-10 max-w-2xl px-6 text-center md:mb-14">
        <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-brand-700">
          Интерактивный ИИ-Наставник
        </span>
        <h3 className="mt-4 font-bold leading-tight tracking-tight text-ink-900 text-balance">
          Попробуйте ИИ-репетитора прямо сейчас
        </h3>
        <p className="mt-4 text-base leading-relaxed text-ink-600 font-medium md:text-lg">
          Персональный виртуальный преподаватель, который моментально объясняет сложные задачи 24/7 и адаптируется под уровень ученика.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {STATUS_BADGES.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-100/80 bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-ink-700 shadow-sm backdrop-blur-sm"
            >
              <span aria-hidden="true">{badge.icon}</span>
              {badge.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-brand-100/50 bg-white/90 p-6 shadow-2xl shadow-brand-950/10 backdrop-blur-md md:p-8 mx-6 sm:mx-auto">
        <div className="absolute -right-20 -top-20 -z-10 h-48 w-48 rounded-full bg-brand-200/25 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 -z-10 h-48 w-48 rounded-full bg-accent-200/15 blur-3xl pointer-events-none" />

        <div className="mb-6 flex items-center justify-between border-b border-ink-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-ink-200" />
              <span className="h-3 w-3 rounded-full bg-accent-300" />
              <span className="h-3 w-3 rounded-full bg-brand-300" />
            </div>
            <div className="h-4 w-px bg-ink-200 mx-2" />
            <span className="text-sm font-bold tracking-wider text-brand-600 uppercase">Interactive Demo</span>
          </div>
        </div>

        <h4 className="mb-2 text-2-5xl font-bold leading-tight tracking-tight text-ink-900">Демо ИИ-репетитора</h4>
        <p className="mb-6 max-w-prose text-ink-600 leading-relaxed">
          Задайте любой школьный вопрос или кликните по подсказке ниже, чтобы проверить его в деле.
        </p>

        <div className="flex max-h-[min(20rem,40dvh)] min-h-[120px] flex-col gap-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="my-auto text-center py-6">
              <span className="text-3xl">💬</span>
              <p className="mt-2 text-sm text-ink-500 font-medium">Чат пуст. Напишите что-нибудь!</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-base leading-relaxed ${
                message.role === "user"
                  ? "ml-auto rounded-tr-none bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : "mr-auto rounded-tl-none bg-brand-50 border border-brand-100 text-ink-800"
              }`}
            >
              {message.parts.map((part, i) =>
                part.type === "text" ? <span key={i}>{part.text}</span> : null,
              )}
            </div>
          ))}

          <AnimatePresence>
            {status === "submitted" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mr-auto flex items-center gap-1.5 rounded-2xl bg-brand-50 border border-brand-100 px-4 py-3"
                aria-label="ИИ-Репетитор печатает ответ"
              >
                <span className="h-2 w-2 rounded-full bg-brand-400 motion-safe:animate-bounce motion-safe:[animation-delay:-0.2s]" />
                <span className="h-2 w-2 rounded-full bg-brand-400 motion-safe:animate-bounce motion-safe:[animation-delay:-0.1s]" />
                <span className="h-2 w-2 rounded-full bg-brand-400 motion-safe:animate-bounce" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!reachedLimit && messages.length === 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handlePromptClick(prompt)}
                className="min-h-[44px] flex items-center rounded-full border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-sm leading-snug font-semibold text-brand-700 transition-all hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {serverErrorMessage && !reachedLimit && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {serverErrorMessage}
          </div>
        )}

        {reachedLimit ? (
          <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50/80 p-6 text-center backdrop-blur-sm">
            <p className="mb-4 text-sm font-semibold text-ink-900 leading-relaxed">
              Бесплатные вопросы закончились — а с живым педагогом вы можете детально разобрать любую тему и составить Карту готовности.
            </p>
            <a
              href="#readiness-map"
              className="inline-block rounded-xl bg-accent-500 px-6 py-3 text-sm font-bold text-ink-900 shadow-md shadow-accent-500/25 transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 active:scale-95"
            >
              Пройти разбор с живым педагогом
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2 sm:flex-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isBusy}
              placeholder="Например: как работают квадратные уравнения?"
              className="flex-1 rounded-xl border border-ink-200 bg-white px-4 py-3.5 text-ink-900 placeholder:text-ink-400 outline-none shadow-sm transition-all duration-200 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isBusy || !input.trim()}
              className="group relative overflow-hidden rounded-xl bg-brand-600 px-8 py-3.5 font-bold text-white shadow-md shadow-brand-900/20 transition-all duration-200 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:hover:bg-brand-600 disabled:active:scale-100"
            >
              {isBusy ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Думаю...
                </span>
              ) : (
                "Задать вопрос ИИ"
              )}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm font-bold uppercase tracking-wider text-brand-500">
          Рядом с ИИ всегда есть живой учитель «Перезагрузки»
        </p>
      </div>
    </div>
  );
}
