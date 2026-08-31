"use client";

import { useMemo, useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { getOrCreateSessionId } from "@/landing/lib/session-id";
import { reachGoal } from "@/landing/lib/analytics";

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

const DEMO_PAIRS = [
  {
    question: "Почему в квадратном уравнении, если дискриминант меньше нуля, то нет корней? 🧐",
    answer:
      "Смотри, всё очень просто! График квадратного уравнения — это парабола. Когда дискриминант меньше нуля, эта парабола парит над осью X и вообще её не касается. Раз нет точек пересечения, значит и корней нет. Парабола просто улетела в космос! 🚀",
  },
  {
    question: "Объясни теорему Пифагора простыми словами",
    answer:
      "Легко! Представь треугольник с прямым углом. Площадь квадратов на двух коротких сторонах, сложенная вместе, — это ровно площадь квадрата на длинной стороне. Вот и вся теорема: a² + b² = c² 📐",
  },
  {
    question: "Как решать 22 задачу ОГЭ по математике?",
    answer:
      "Сначала выпиши отдельно, что дано и что нужно найти — на черновик, а не в уме. Дальше ищи формулу, которая связывает именно эти величины. Почти все ошибки в 22 задаче — от того, что решают в уме, не зафиксировав условие 📝",
  },
  {
    question: "Разбери ошибки в сочинении 9.3",
    answer:
      "Скинь текст — покажу, где именно теряются баллы: в тезисе, в аргументах или в выводе. Чаще всего проблема в тезисе — он должен отвечать на вопрос из задания почти теми же словами ✍️",
  },
];

const DEMO_ANSWER_DELAY_MS = 1400;
const DEMO_PAIR_HOLD_MS = 4200;

export default function AITutor() {
  const [input, setInput] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState(true);
  const [demoIndex, setDemoIndex] = useState(0);
  const [demoShowAnswer, setDemoShowAnswer] = useState(false);
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
  const showDemo = autoplay && messages.length === 0;

  useEffect(() => {
    if (!autoplay) return;
    setDemoShowAnswer(false);
    const answerTimer = setTimeout(() => setDemoShowAnswer(true), DEMO_ANSWER_DELAY_MS);
    const nextTimer = setTimeout(() => {
      setDemoIndex((i) => (i + 1) % DEMO_PAIRS.length);
    }, DEMO_PAIR_HOLD_MS);
    return () => {
      clearTimeout(answerTimer);
      clearTimeout(nextTimer);
    };
  }, [autoplay, demoIndex]);

  const stopAutoplay = () => setAutoplay(false);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    stopAutoplay();
    const trimmed = input.trim();
    if (!trimmed || reachedLimit || isBusy) return;
    setServerErrorMessage(null);
    sendMessage({ text: trimmed });
    setInput("");
  };

  const handlePromptClick = (prompt: string) => {
    stopAutoplay();
    if (reachedLimit || isBusy) return;
    setInput(prompt);
  };

  return (
    <div className="relative overflow-hidden py-12 md:py-20 bg-transparent">
      <div className="mx-auto mb-8 max-w-2xl px-6 text-center md:mb-12">
        <h3 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#0055FF] tracking-tight leading-tight text-balance">
          Смотрите, как работает ИИ-репетитор
        </h3>
        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-ink-900 font-bold leading-relaxed max-w-4xl mx-auto mt-4">
          Персональный виртуальный преподаватель, который моментально объясняет сложные задачи 24/7 и адаптируется под уровень ученика.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {STATUS_BADGES.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-1.5 text-sm md:text-base lg:text-lg font-bold px-5 py-2.5 rounded-full border-2 border-brand-200 bg-white shadow-md text-ink-700"
            >
              <span aria-hidden="true">{badge.icon}</span>
              {badge.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-3xl flex flex-col justify-between min-h-[580px] overflow-hidden rounded-3xl border border-brand-200/80 bg-white/95 p-6 shadow-xl shadow-brand-900/5 backdrop-blur-md md:p-8 mx-6 sm:mx-auto">
        
        <div>
          <div className="mb-5 flex items-center justify-between border-b border-ink-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-ink-200" />
                <span className="h-3 w-3 rounded-full bg-accent-300" />
                <span className="h-3 w-3 rounded-full bg-brand-300" />
              </div>
              <div className="h-4 w-px bg-ink-200 mx-2" />
              <span className="text-xs md:text-sm font-bold tracking-wider text-brand-600 uppercase">Interactive Demo</span>
            </div>
          </div>

          <h4 className="mb-1 text-xl md:text-2xl font-bold leading-tight tracking-tight text-ink-900">Демо ИИ-репетитора</h4>
          <p className="mb-5 text-sm text-ink-600 leading-relaxed">
            Задайте любой школьный вопрос или кликните по подсказке ниже, чтобы проверить его в деле.
          </p>
        </div>

        <div className="flex-1 flex flex-col justify-start min-h-[250px] overflow-y-auto pr-1">
          {showDemo ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={demoIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex flex-col gap-3.5"
              >
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-none bg-brand-600 px-4 py-3 text-sm md:text-base leading-relaxed text-white shadow-md shadow-brand-600/20">
                  {DEMO_PAIRS[demoIndex].question}
                </div>

                <div className="min-h-[140px] flex items-start">
                  {demoShowAnswer ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="mr-auto max-w-[88%] rounded-2xl rounded-tl-none border border-brand-100 bg-brand-50/90 px-4 py-3 text-sm md:text-base leading-relaxed text-ink-800"
                    >
                      {DEMO_PAIRS[demoIndex].answer}
                    </motion.div>
                  ) : (
                    <div
                      className="mr-auto flex items-center gap-1.5 rounded-2xl rounded-tl-none border border-brand-100 bg-brand-50 px-4 py-3"
                      aria-label="ИИ-Репетитор печатает ответ"
                    >
                      <span className="h-2 w-2 rounded-full bg-brand-400 motion-safe:animate-bounce motion-safe:[animation-delay:-0.2s]" />
                      <span className="h-2 w-2 rounded-full bg-brand-400 motion-safe:animate-bounce motion-safe:[animation-delay:-0.1s]" />
                      <span className="h-2 w-2 rounded-full bg-brand-400 motion-safe:animate-bounce" />
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            messages.length === 0 && (
              <div className="my-auto text-center py-6">
                <span className="text-3xl">💬</span>
                <p className="mt-2 text-sm text-ink-500 font-medium">Чат пуст. Напишите что-нибудь!</p>
              </div>
            )
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base leading-relaxed ${
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

        <div className="mt-4 border-t border-ink-100 pt-4">
          {!reachedLimit && messages.length === 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handlePromptClick(prompt)}
                  className="min-h-[40px] flex items-center rounded-full border border-brand-200 bg-brand-50/90 px-3.5 py-2 text-xs md:text-sm font-semibold text-brand-700 transition-all hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {serverErrorMessage && !reachedLimit && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs md:text-sm font-medium text-red-700">
              {serverErrorMessage}
            </div>
          )}

          {reachedLimit ? (
            <div className="rounded-2xl border border-accent-200 bg-accent-50/80 p-5 text-center backdrop-blur-sm">
              <p className="mb-3 text-sm font-semibold text-ink-900 leading-relaxed">
                Бесплатные вопросы закончились — а с живым педагогом вы можете детально разобрать любую тему.
              </p>
              <a
                href="#readiness-map"
                onClick={() => reachGoal("cta_analysis_click")}
                className="inline-flex min-h-[52px] items-center rounded-xl bg-brand-600 px-6 text-sm font-bold text-white shadow-md shadow-brand-600/25 transition-all hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 active:scale-95"
              >
                Записаться на бесплатный разбор
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={stopAutoplay}
                disabled={isBusy}
                placeholder="Например: как работают квадратные уравнения?"
                className="flex-1 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm md:text-base text-ink-900 placeholder:text-ink-400 outline-none shadow-sm transition-all duration-200 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isBusy || !input.trim()}
                className="group relative overflow-hidden rounded-xl bg-brand-600 px-7 py-3 text-sm md:text-base font-bold text-white shadow-md shadow-brand-900/20 transition-all duration-200 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95 disabled:opacity-50 disabled:hover:bg-brand-600 disabled:active:scale-100"
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

          <p className="mt-3.5 text-center text-xs md:text-sm font-bold uppercase tracking-wider text-brand-600">
            Рядом с ИИ всегда есть живой учитель «Перезагрузки»
          </p>
        </div>
      </div>
    </div>
  );
}