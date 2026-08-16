import { z } from "zod";

// Hard caps on the AI Tutor chat payload before it's forwarded to Gemini.
// Prevents unbounded conversation histories / oversized single messages from
// driving up token cost or hanging the model call.
export const MAX_CHAT_MESSAGES = 12;
export const MAX_MESSAGE_TEXT_LENGTH = 2000;
export const MAX_TOTAL_CHAT_CHARS = 8000;

const chatTextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1).max(MAX_MESSAGE_TEXT_LENGTH),
});

const chatMessageSchema = z.object({
  id: z.string().max(200),
  role: z.enum(["user", "assistant"]),
  // The AI Tutor client only ever sends text parts (see AITutor.tsx's
  // sendMessage({ text })), so restricting to text here rejects any other
  // UIMessage part type (file, tool-call, data, ...) outright rather than
  // silently forwarding unexpected content to the model.
  parts: z.array(chatTextPartSchema).min(1).max(20),
});

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, "Сообщение не может быть пустым")
    .max(MAX_CHAT_MESSAGES, "Слишком длинная история диалога"),
  sessionId: z.string().max(200).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export function totalChatChars(messages: ChatRequest["messages"]): number {
  return messages.reduce(
    (sum, message) => sum + message.parts.reduce((partSum, part) => partSum + part.text.length, 0),
    0,
  );
}
