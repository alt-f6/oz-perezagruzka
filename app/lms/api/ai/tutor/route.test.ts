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

  it("orders system messages core → toc → topic for prefix caching", async () => {
    await POST(makeRequest({ topicCode: "1.4", messages: [userMessage] }));

    expect(loadTopicMock).toHaveBeenCalledWith("1.4");
    const call = streamTextMock.mock.calls[0][0] as {
      messages: { role: string; content: string }[];
    };
    expect(call.messages[0]).toEqual({ role: "system", content: "CORE_PROMPT" });
    expect(call.messages[1]).toEqual({ role: "system", content: "TOC_CONTENT" });
    expect(call.messages[2].role).toBe("system");
    expect(call.messages[2].content).toContain("TOPIC_MATERIAL");
    expect(call.messages[2].content).toContain("1.4");
    // The user turn follows the system prefix.
    expect(call.messages[3]).toMatchObject({ role: "user" });
  });

  it("returns 400 when the pack cannot be loaded", async () => {
    loadTopicMock.mockRejectedValue(new Error("ENOENT"));
    const res = await POST(makeRequest({ topicCode: "1.5", messages: [userMessage] }));
    expect(res.status).toBe(400);
    expect(streamTextMock).not.toHaveBeenCalled();
  });
});
