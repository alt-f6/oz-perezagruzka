import { streamText, convertToModelMessages, type ModelMessage, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { requireRole } from "@/shared/lib/rbac";
import { createLogger } from "@/shared/lib/logger";
import {
  tutorRequestSchema,
  totalTutorChars,
  MAX_TOTAL_TUTOR_CHARS,
} from "@/lms/lib/tutor";
import { loadCore, loadToc, loadTopic } from "@/lms/server/tutor-pack";

export const runtime = "nodejs";

const logger = createLogger("lms.api.ai.tutor");

// Falls back to GEMINI_API_KEY if DEEPSEEK_API_KEY is unset, mirroring the
// landing AI call sites (see .env.example / readiness-service.ts).
const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
});

const MODEL_ID = "deepseek-chat";
const CHAT_TIMEOUT_MS = 30_000;

export async function POST(req: Request) {
  // Student-only feature (admins bypass for support/QA).
  try {
    await requireRole(["STUDENT"], { adminBypass: true });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawBody: unknown = await req.json().catch(() => null);
  const parsed = tutorRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    // Non-whitelisted topicCode / malformed payload → 400.
    return Response.json({ error: "Некорректный запрос." }, { status: 400 });
  }

  const { messages, topicCode } = parsed.data;

  if (totalTutorChars(messages) > MAX_TOTAL_TUTOR_CHARS) {
    return Response.json({ error: "Сообщение слишком длинное." }, { status: 400 });
  }

  // Load the local subject pack. topicCode is already whitelist-validated by
  // the schema; loadTopic re-checks and reads the file. A missing file (should
  // not happen for a whitelisted code) is surfaced as a 400, not a 500.
  let core: string;
  let toc: string;
  let topicMaterial: string;
  try {
    [core, toc, topicMaterial] = await Promise.all([
      loadCore(),
      loadToc(),
      loadTopic(topicCode),
    ]);
  } catch (error) {
    logger.error("Failed to load tutor pack", error);
    return Response.json({ error: "Тема недоступна." }, { status: 400 });
  }

  // Ordered for DeepSeek automatic prefix caching: the most stable content
  // comes first so the longest possible token prefix is shared across requests.
  //   core  → identical for every request
  //   toc   → identical for every request
  //   topic → identical for every request on the same topic
  // Only the trailing conversation varies, so switching topics still reuses the
  // core+toc prefix, and repeat turns on one topic reuse core+toc+topic.
  const systemMessages: ModelMessage[] = [
    { role: "system", content: core },
    { role: "system", content: toc },
    {
      role: "system",
      content: `Материал текущей темы ${topicCode}. Отвечай строго в её рамках.\n\n${topicMaterial}`,
    },
  ];

  const conversation = await convertToModelMessages(messages as unknown as UIMessage[]);

  const result = streamText({
    // DeepSeek only implements Chat Completions, not OpenAI's Responses API,
    // so the model must be selected via .chat() explicitly.
    model: deepseek.chat(MODEL_ID),
    messages: [...systemMessages, ...conversation],
    timeout: { totalMs: CHAT_TIMEOUT_MS },
    onError: async ({ error }) => {
      logger.error("AI tutor stream error", error);
    },
  });

  return result.toUIMessageStreamResponse();
}
