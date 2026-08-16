import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { checkRateLimit } from "@/landing/lib/rate-limit";
import { hashRequestHeaders } from "@/landing/lib/request-ip";
import { prisma } from "@/landing/lib/db";
import {
  chatRequestSchema,
  totalChatChars,
  MAX_TOTAL_CHAT_CHARS,
} from "@/landing/lib/validations/chat";

export const runtime = "nodejs";

const google = createGoogle({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_ID = "gemini-2.5-flash";
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
          "Бесплатные вопросы на сегодня закончились. Запишитесь на бесплатную диагностику — там на связи живой педагог.",
        code: "RATE_LIMITED",
      },
      { status: 429 },
    );
  }

  const startedAt = Date.now();

  const result = streamText({
    model: google(MODEL_ID),
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
