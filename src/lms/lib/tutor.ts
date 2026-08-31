import { z } from "zod";

/**
 * Whitelist for the обществознание block-1 topic codes (1.1 … 1.15).
 * Matches `1.1`–`1.9` and `1.10`–`1.15` only. Validated BEFORE any file path
 * is built from the code, so it doubles as path-traversal protection (no
 * slashes, dots-dots, or other separators can pass).
 */
export const TOPIC_CODE_PATTERN = /^1\.(1[0-5]|[1-9])$/;

export function isValidTopicCode(code: unknown): code is string {
  return typeof code === "string" && TOPIC_CODE_PATTERN.test(code);
}

// Payload caps — mirror the landing AI chat contract (src/landing/lib/validations/chat.ts).
export const MAX_TUTOR_MESSAGES = 32;
export const MAX_TOTAL_TUTOR_CHARS = 12000;

// A single UIMessage part. The AI SDK's assistant turns carry MORE than text
// parts — e.g. `{ type: "step-start" }`, reasoning, tool parts — which get
// replayed verbatim on the next turn. So we accept ANY part shape here (unknown
// keys are stripped by zod) and pull the text out during sanitization. A strict
// `type: "text"` schema would reject the whole history from turn 2 onward.
const tutorPartSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
});

const tutorMessageSchema = z.object({
  id: z.string().max(200).optional(),
  // Accept `system` in the payload so it can be stripped rather than rejecting
  // the request; only user/assistant survive sanitization.
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(tutorPartSchema).max(64).optional(),
  // Some clients send a flat `content` string instead of parts.
  content: z.string().optional(),
});

export const tutorRequestSchema = z.object({
  topicCode: z.string().regex(TOPIC_CODE_PATTERN, "Некорректный код темы"),
  messages: z
    .array(tutorMessageSchema)
    .min(1, "Сообщение не может быть пустым")
    .max(MAX_TUTOR_MESSAGES, "Слишком длинная история диалога"),
  sessionId: z.string().max(200).optional(),
});

export type TutorRequest = z.infer<typeof tutorRequestSchema>;
type TutorMessage = TutorRequest["messages"][number];

export interface SanitizedMessage {
  role: "user" | "assistant";
  content: string;
}

/** Extracts the plain-text content of a UIMessage from its parts (or flat content). */
function messageText(message: TutorMessage): string {
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content;
  }
  const parts = message.parts ?? [];
  return parts
    .filter(
      (part) =>
        (part.type === undefined || part.type === "text") &&
        typeof part.text === "string",
    )
    .map((part) => part.text as string)
    .join("");
}

/**
 * Normalizes a raw UIMessage history into the clean, provider-safe shape
 * DeepSeek's Chat Completions API expects:
 *  - drops `system` turns (system context is passed via streamText's `system`),
 *  - extracts text and drops empty / whitespace-only turns (e.g. the empty
 *    assistant placeholder left behind by a failed/streaming turn),
 *  - collapses consecutive same-role turns so the sequence strictly alternates.
 * A provider call with empty content or a stray system turn is exactly what was
 * 400-ing the second turn, so this runs before every request.
 */
export function sanitizeTutorMessages(messages: TutorMessage[]): SanitizedMessage[] {
  const cleaned: SanitizedMessage[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = messageText(message).trim();
    if (!text) continue;

    const last = cleaned[cleaned.length - 1];
    if (last && last.role === message.role) {
      last.content = `${last.content}\n\n${text}`;
    } else {
      cleaned.push({ role: message.role, content: text });
    }
  }
  return cleaned;
}

export function totalTutorChars(messages: SanitizedMessage[]): number {
  return messages.reduce((sum, message) => sum + message.content.length, 0);
}

export interface TutorManifest {
  id: string;
  subject: string;
  exam: string;
  title: string;
  version: number;
  topics: { code: string; title: string }[];
}
