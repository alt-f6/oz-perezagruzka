import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { checkRateLimit } from "@/landing/lib/rate-limit";
import { hashRequestHeaders } from "@/landing/lib/request-ip";
import { prisma } from "@/landing/lib/db";
import {
  chatRequestSchema,
  totalChatChars,
  MAX_TOTAL_CHAT_CHARS,
} from "@/landing/lib/validations/chat";

export const runtime = "nodejs";

// Falls back to GEMINI_API_KEY if DEEPSEEK_API_KEY is unset, to ease
// migration — mirrors the same fallback in readiness-service.ts.
const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
});

const MODEL_ID = "deepseek-chat";
const MAX_MESSAGES_PER_WINDOW = 3;
const WINDOW_MS = 60 * 60 * 1000;
const CHAT_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `Ты — ИИ-репетитор школы «Перезагрузка» для подростков 14–15 лет, готовящихся к ОГЭ.
Объясняй просто, на языке подростка, короткими фразами, с одним примером из жизни. Без воды и академизма.
После объяснения задай короткий проверочный вопрос. Не по программе — мягко верни к учёбе.
Не решай домашку целиком. В конце по-доброму напомни, что рядом с ИИ всегда есть живой учитель.
По-русски, максимум 150 слов, без markdown-заголовков.`;

export async function POST(req: Request) {
  const rawBody: unknown = await req.json();
  const parsed = chatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Некорректный запрос." },
      { status: 400 },
    );
  }
  const { messages, sessionId } = parsed.data;

  if (totalChatChars(messages) > MAX_TOTAL_CHAT_CHARS) {
    return Response.json(
      { error: "Сообщение слишком длинное." },
      { status: 400 },
    );
  }

  const ipHash = hashRequestHeaders(req.headers);
  const rateLimitKey = `chat:${ipHash}`;

  const rateLimit = await checkRateLimit(rateLimitKey, MAX_MESSAGES_PER_WINDOW, WINDOW_MS);
  if (!rateLimit.success) {
    return Response.json(
      {
        error:
          "Бесплатные вопросы на сегодня закончились. Запишитесь на бесплатный разбор — там на связи живой педагог.",
        code: "RATE_LIMITED",
      },
      { status: 429 },
    );
  }

  const startedAt = Date.now();

  const result = streamText({
    // DeepSeek only implements the Chat Completions API, not OpenAI's newer
    // Responses API — must use .chat() explicitly, since the provider's
    // default call signature targets /v1/responses, which DeepSeek 404s on.
    model: deepseek.chat(MODEL_ID),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages as unknown as UIMessage[]),
    timeout: { totalMs: CHAT_TIMEOUT_MS },
    onEnd: async ({ text }) => {
      try {
        await prisma.aiChatLog.create({
          data: {
            sessionId: sessionId ?? "unknown",
            feature: "TUTOR_DEMO",
            role: "ASSISTANT",
            content: text,
            model: MODEL_ID,
            latencyMs: Date.now() - startedAt,
            failed: false,
          },
        });
      } catch (error) {
        console.error("Failed to log AI tutor interaction", error);
      }
    },
    onError: async ({ error }) => {
      try {
        await prisma.aiChatLog.create({
          data: {
            sessionId: sessionId ?? "unknown",
            feature: "TUTOR_DEMO",
            role: "ASSISTANT",
            content: "",
            failed: true,
            errorMessage: error instanceof Error ? error.message : "Unknown AI error",
          },
        });
      } catch (dbError) {
        console.error("Failed to log AI tutor failure", dbError);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
