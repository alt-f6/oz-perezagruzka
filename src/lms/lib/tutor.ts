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
export const MAX_TUTOR_MESSAGES = 16;
export const MAX_MESSAGE_TEXT_LENGTH = 2000;
export const MAX_TOTAL_TUTOR_CHARS = 12000;

const tutorTextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(MAX_MESSAGE_TEXT_LENGTH),
});

const tutorMessageSchema = z.object({
  id: z.string().max(200),
  role: z.enum(["user", "assistant"]),
  parts: z.array(tutorTextPartSchema).min(1).max(20),
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

export function totalTutorChars(messages: TutorRequest["messages"]): number {
  return messages.reduce(
    (sum, message) =>
      sum + message.parts.reduce((partSum, part) => partSum + part.text.length, 0),
    0,
  );
}

export interface TutorManifest {
  id: string;
  subject: string;
  exam: string;
  title: string;
  version: number;
  topics: { code: string; title: string }[];
}
