import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.fn();
const streamTextMock = vi.fn();
const loadCoreMock = vi.fn();
const loadTocMock = vi.fn();
const loadTopicMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/logger", () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));
vi.mock("@/lms/server/tutor-pack", () => ({
  loadCore: () => loadCoreMock(),
  loadToc: () => loadTocMock(),
  loadTopic: (code: string) => loadTopicMock(code),
}));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => ({ chat: () => "deepseek-model" }),
}));
vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => streamTextMock(...args),
  convertToModelMessages: async (m: unknown) => m,
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/ai/tutor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const userMessage = {
  id: "m1",
  role: "user" as const,
  parts: [{ type: "text" as const, text: "Что такое истина?" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue({ id: "student_1", role: "STUDENT" });
  loadCoreMock.mockResolvedValue("CORE_PROMPT");
  loadTocMock.mockResolvedValue("TOC_CONTENT");
  loadTopicMock.mockResolvedValue("TOPIC_MATERIAL");
  streamTextMock.mockReturnValue({
    toUIMessageStreamResponse: () => new Response("stream", { status: 200 }),
  });
});

describe("POST /api/ai/tutor", () => {
  it("returns 401 when the caller is not an authenticated student", async () => {
    requireRoleMock.mockRejectedValue(new Error("unauthorized"));
    const res = await POST(makeRequest({ topicCode: "1.5", messages: [userMessage] }));
    expect(res.status).toBe(401);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("rejects a non-whitelisted topic code with HTTP 400", async () => {
    for (const topicCode of ["1.16", "1.0", "2.1", "1.", "1.5; rm", "../secret"]) {
      const res = await POST(makeRequest({ topicCode, messages: [userMessage] }));
      expect(res.status, `topicCode=${topicCode}`).toBe(400);
    }
    expect(loadTopicMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("accepts every whitelisted topic code 1.1 … 1.15", async () => {
    const codes = Array.from({ length: 15 }, (_, i) => `1.${i + 1}`);
    for (const topicCode of codes) {
      const res = await POST(makeRequest({ topicCode, messages: [userMessage] }));
      expect(res.status, `topicCode=${topicCode}`).toBe(200);
    }
  });

  it("passes topic context via the system option, not inside messages", async () => {
    await POST(makeRequest({ topicCode: "1.4", messages: [userMessage] }));

    expect(loadTopicMock).toHaveBeenCalledWith("1.4");
    const call = streamTextMock.mock.calls[0][0] as {
      system: string;
      messages: { role: string; content: unknown }[];
    };

    // Compiled instruction block, ordered core → toc → topic for prefix caching.
    expect(typeof call.system).toBe("string");
    const coreAt = call.system.indexOf("CORE_PROMPT");
    const tocAt = call.system.indexOf("TOC_CONTENT");
    const topicAt = call.system.indexOf("TOPIC_MATERIAL");
    expect(coreAt).toBeGreaterThanOrEqual(0);
    expect(coreAt).toBeLessThan(tocAt);
    expect(tocAt).toBeLessThan(topicAt);
    expect(call.system).toContain("1.4");

    // messages must contain ONLY client turns — no system role may leak in.
    expect(call.messages.every((m) => m.role !== "system")).toBe(true);
    expect(call.messages[0]).toMatchObject({ role: "user" });
  });

  it("accepts a multi-turn history with SDK part types and empty placeholders (no turn-2 crash)", async () => {
    const res = await POST(
      makeRequest({
        topicCode: "1.1",
        messages: [
          { id: "u1", role: "user", parts: [{ type: "text", text: "Привет" }] },
          {
            id: "a1",
            role: "assistant",
            parts: [{ type: "step-start" }, { type: "text", text: "Здравствуй!" }],
          },
          { id: "a-empty", role: "assistant", parts: [{ type: "step-start" }] },
          {
            id: "u2",
            role: "user",
            parts: [{ type: "text", text: "Биологическое — это речь?" }],
          },
        ],
      }),
    );

    expect(res.status).toBe(200);
    const call = streamTextMock.mock.calls[0][0] as {
      messages: { role: string; content: string }[];
    };
    // Sanitized to strictly alternating, non-empty, string-content turns.
    expect(call.messages).toEqual([
      { role: "user", content: "Привет" },
      { role: "assistant", content: "Здравствуй!" },
      { role: "user", content: "Биологическое — это речь?" },
    ]);
    // No empty content and no leftover placeholder turns.
    expect(call.messages.every((m) => m.content.trim().length > 0)).toBe(true);
  });

  it("returns 400 when the sanitized history is empty", async () => {
    const res = await POST(
      makeRequest({
        topicCode: "1.1",
        messages: [{ id: "a1", role: "assistant", parts: [{ type: "step-start" }] }],
      }),
    );
    expect(res.status).toBe(400);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the pack cannot be loaded", async () => {
    loadTopicMock.mockRejectedValue(new Error("ENOENT"));
    const res = await POST(makeRequest({ topicCode: "1.5", messages: [userMessage] }));
    expect(res.status).toBe(400);
    expect(streamTextMock).not.toHaveBeenCalled();
  });
});
