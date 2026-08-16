import { describe, it, expect, vi, beforeEach } from "vitest";

const checkRateLimitMock = vi.fn();
const headersMock = vi.fn();
const generateReadinessMapMock = vi.fn();
const recordConsentMock = vi.fn();

vi.mock("@/landing/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));
vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));
vi.mock("@/landing/lib/db", () => ({
  prisma: {
    lead: { create: vi.fn(), update: vi.fn() },
    aiChatLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/landing/lib/consent-log", () => ({
  recordConsent: (...args: unknown[]) => recordConsentMock(...args),
}));
vi.mock("@/landing/lib/ai/readiness-service", () => ({
  generateReadinessMap: (...args: unknown[]) => generateReadinessMapMock(...args),
}));

const VALID_INPUT = {
  input: {
    name: "Тест Тестов",
    grade: "9" as const,
    subjects: "Математика",
    studyStyle: "Учится самостоятельно, высокая успеваемость" as const,
    hobbies: "Спорт и активный отдых",
    deadline: "3-6m" as const,
  },
  sessionId: "session-1",
  utm: {},
  consent: true as const,
};

describe("submitReadinessMap", () => {
  beforeEach(() => {
    checkRateLimitMock.mockReset();
    headersMock.mockReset();
    headersMock.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.5" }));
    generateReadinessMapMock.mockReset();
    recordConsentMock.mockReset();
  });

  it("returns a fallback-shaped result and performs zero side effects when the honeypot is filled", async () => {
    checkRateLimitMock.mockResolvedValue({ success: true, remaining: 2, resetAt: Date.now() });
    const { prisma } = await import("@/landing/lib/db");
    const { submitReadinessMap } = await import("./readiness");

    vi.mocked(prisma.lead.create).mockReset();
    vi.mocked(prisma.aiChatLog.create).mockReset();

    const result = await submitReadinessMap({
      ...VALID_INPUT,
      honeypot: "i-am-a-bot",
    });

    expect(result).toEqual({
      status: "fallback",
      leadId: "bot-detected",
      message: expect.any(String),
    });
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(recordConsentMock).not.toHaveBeenCalled();
    expect(generateReadinessMapMock).not.toHaveBeenCalled();
  });

  it("returns a fallback-shaped result and performs zero side effects when submitted too fast", async () => {
    checkRateLimitMock.mockResolvedValue({ success: true, remaining: 2, resetAt: Date.now() });
    const { prisma } = await import("@/landing/lib/db");
    const { submitReadinessMap } = await import("./readiness");

    vi.mocked(prisma.lead.create).mockReset();
    vi.mocked(prisma.aiChatLog.create).mockReset();

    const result = await submitReadinessMap({
      ...VALID_INPUT,
      formRenderedAt: Date.now(),
    });

    expect(result.status).toBe("fallback");
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(recordConsentMock).not.toHaveBeenCalled();
    expect(generateReadinessMapMock).not.toHaveBeenCalled();
  });

  it("rejects with a structured error when the rate limit is exceeded, without touching the DB or AI service", async () => {
    checkRateLimitMock.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() });
    const { prisma } = await import("@/landing/lib/db");
    const { submitReadinessMap } = await import("./readiness");

    vi.mocked(prisma.lead.create).mockReset();

    const result = await submitReadinessMap({
      ...VALID_INPUT,
      formRenderedAt: Date.now() - 10_000,
    });

    expect(result).toEqual({
      status: "error",
      message: expect.any(String),
    });
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.stringMatching(/^readiness:/),
      3,
      60 * 60 * 1000,
    );
    expect(prisma.lead.create).not.toHaveBeenCalled();
    expect(generateReadinessMapMock).not.toHaveBeenCalled();
  });

  it("proceeds through lead.create and recordConsent for a normal, non-bot, under-limit submission", async () => {
    checkRateLimitMock.mockResolvedValue({ success: true, remaining: 2, resetAt: Date.now() });
    const { prisma } = await import("@/landing/lib/db");
    const { submitReadinessMap } = await import("./readiness");

    vi.mocked(prisma.lead.create).mockReset();
    vi.mocked(prisma.lead.create).mockResolvedValue({
      id: "lead-1",
      name: "Тест Тестов",
      sessionId: "session-1",
    } as never);
    vi.mocked(prisma.aiChatLog.create).mockReset();
    vi.mocked(prisma.aiChatLog.create).mockResolvedValue({} as never);
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
    recordConsentMock.mockResolvedValue(undefined);
    generateReadinessMapMock.mockResolvedValue({
      output: {
        readinessScore: 72,
        whatISee: "...",
        attentionZones: "...",
        strengths: "...",
        futurePaths: "...",
        firstStep: "...",
      },
      model: "gemini-2.5-flash",
      latencyMs: 100,
    });

    const result = await submitReadinessMap({
      ...VALID_INPUT,
      formRenderedAt: Date.now() - 10_000,
    });

    expect(result.status).toBe("success");
    expect(prisma.lead.create).toHaveBeenCalledTimes(1);
    expect(recordConsentMock).toHaveBeenCalledTimes(1);
    expect(recordConsentMock).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: "lead-1", consentType: "PRIVACY_POLICY" }),
    );
    expect(generateReadinessMapMock).toHaveBeenCalledTimes(1);
  });
});
