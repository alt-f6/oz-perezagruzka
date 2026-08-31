import { describe, expect, it } from "vitest";
import { sanitizeTutorMessages, totalTutorChars, tutorRequestSchema } from "./tutor";

describe("sanitizeTutorMessages", () => {
  it("keeps a valid alternating user/assistant history as clean text turns", () => {
    const result = sanitizeTutorMessages([
      { id: "u1", role: "user", parts: [{ type: "text", text: "Привет" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Здравствуй!" }] },
      { id: "u2", role: "user", parts: [{ type: "text", text: "Что такое общество?" }] },
    ]);
    expect(result).toEqual([
      { role: "user", content: "Привет" },
      { role: "assistant", content: "Здравствуй!" },
      { role: "user", content: "Что такое общество?" },
    ]);
  });

  it("extracts text from SDK assistant turns that also carry non-text parts", () => {
    // This is exactly the turn-2 payload useChat replays: a step-start part
    // alongside the streamed text. It must NOT drop the message.
    const result = sanitizeTutorMessages([
      { id: "u1", role: "user", parts: [{ type: "text", text: "Привет" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "step-start" }, { type: "text", text: "Здравствуй!" }],
      },
      { id: "u2", role: "user", parts: [{ type: "text", text: "А биологическое?" }] },
    ]);
    expect(result.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(result[1]).toEqual({ role: "assistant", content: "Здравствуй!" });
  });

  it("drops empty / whitespace-only placeholder turns", () => {
    const result = sanitizeTutorMessages([
      { id: "u1", role: "user", parts: [{ type: "text", text: "Привет" }] },
      { id: "a1", role: "assistant", parts: [{ type: "step-start" }] }, // empty placeholder
      { id: "a2", role: "assistant", parts: [{ type: "text", text: "   " }] }, // whitespace
    ]);
    expect(result).toEqual([{ role: "user", content: "Привет" }]);
  });

  it("strips system turns entirely", () => {
    const result = sanitizeTutorMessages([
      { role: "system", content: "leaked system prompt" },
      { id: "u1", role: "user", parts: [{ type: "text", text: "Вопрос" }] },
    ]);
    expect(result).toEqual([{ role: "user", content: "Вопрос" }]);
  });

  it("collapses consecutive same-role turns so roles strictly alternate", () => {
    const result = sanitizeTutorMessages([
      { id: "u1", role: "user", parts: [{ type: "text", text: "Первое" }] },
      { id: "u2", role: "user", parts: [{ type: "text", text: "Второе" }] },
    ]);
    expect(result).toEqual([{ role: "user", content: "Первое\n\nВторое" }]);
  });

  it("supports a flat content string as well as parts", () => {
    const result = sanitizeTutorMessages([{ role: "user", content: "Плоский текст" }]);
    expect(result).toEqual([{ role: "user", content: "Плоский текст" }]);
  });
});

describe("tutorRequestSchema", () => {
  it("accepts a multi-turn history containing non-text assistant parts", () => {
    const parsed = tutorRequestSchema.safeParse({
      topicCode: "1.1",
      messages: [
        { id: "u1", role: "user", parts: [{ type: "text", text: "Привет" }] },
        {
          id: "a1",
          role: "assistant",
          parts: [{ type: "step-start" }, { type: "text", text: "Здравствуй!" }],
        },
        { id: "u2", role: "user", parts: [{ type: "text", text: "Дальше" }] },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("totalTutorChars", () => {
  it("sums sanitized content lengths", () => {
    expect(
      totalTutorChars([
        { role: "user", content: "abc" },
        { role: "assistant", content: "de" },
      ]),
    ).toBe(5);
  });
});
