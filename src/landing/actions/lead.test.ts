import { describe, it, expect, vi, beforeEach } from "vitest";

const checkRateLimitMock = vi.fn();
const headersMock = vi.fn();

vi.mock("@/landing/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
}));
vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));
vi.mock("@/landing/lib/db", () => ({
  prisma: {
    lead: { update: vi.fn(), findUnique: vi.fn() },
    aiChatLog: { findFirst: vi.fn() },
    consentLog: { create: vi.fn() },
  },
}));
vi.mock("@/landing/lib/telegram", () => ({
  sendTelegramNotification: vi.fn().mockResolvedValue(undefined),
}));
const recordConsentMock = vi.fn();
vi.mock("@/landing/lib/consent-log", () => ({
  recordConsent: (...args: unknown[]) => recordConsentMock(...args),
}));

describe("attachLeadContact rate limiting", () => {
  beforeEach(() => {
    checkRateLimitMock.mockReset();
    headersMock.mockReset();
    headersMock.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.5" }));
    recordConsentMock.mockReset();
  });

  it("rejects with a structured error when the rate limit is exceeded", async () => {
    checkRateLimitMock.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() });
    const { attachLeadContact } = await import("./lead");

    const result = await attachLeadContact({
      leadId: "lead-1",
      phone: "+7 (999) 123-45-67",
      consent: true,
    });

    expect(result).toEqual({
      status: "error",
      message: "Слишком много попыток. Попробуйте ещё раз через час.",
    });
    expect(checkRateLimitMock).toHaveBeenCalledWith(
      expect.stringMatching(/^lead-contact:/),
      5,
      60 * 60 * 1000,
    );
  });
});

describe("attachLeadContact bot defense", () => {
  beforeEach(() => {
    checkRateLimitMock.mockReset();
    headersMock.mockReset();
    headersMock.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.5" }));
    recordConsentMock.mockReset();
    checkRateLimitMock.mockResolvedValue({ success: true, remaining: 4, resetAt: Date.now() });
  });

  it("returns a fake success and performs zero DB writes when the honeypot is filled", async () => {
    const { prisma } = await import("@/landing/lib/db");
    const { attachLeadContact } = await import("./lead");

    vi.mocked(prisma.lead.update).mockReset();
    vi.mocked(prisma.consentLog.create).mockReset();
    recordConsentMock.mockReset();

    const result = await attachLeadContact({
      leadId: "lead-bot",
      phone: "+7 (999) 123-45-67",
      consent: true,
      honeypot: "i-am-a-bot",
    });

    expect(result).toEqual({ status: "ok" });
    expect(recordConsentMock).not.toHaveBeenCalled();
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.consentLog.create).not.toHaveBeenCalled();
  });

  it("passes non-bot submissions through to the normal rate-limit/DB flow", async () => {
    const { prisma } = await import("@/landing/lib/db");
    const { attachLeadContact } = await import("./lead");

    vi.mocked(prisma.lead.update).mockReset();
    vi.mocked(prisma.lead.update).mockResolvedValue({
      id: "lead-ok",
      name: "Test Student",
      sessionId: "session-1",
      readinessScore: 80,
    } as never);
    vi.mocked(prisma.aiChatLog.findFirst).mockReset();
    vi.mocked(prisma.aiChatLog.findFirst).mockResolvedValue(null as never);
    recordConsentMock.mockReset();
    recordConsentMock.mockResolvedValue(undefined);

    const result = await attachLeadContact({
      leadId: "lead-ok",
      phone: "+7 (999) 123-45-67",
      consent: true,
      formRenderedAt: Date.now() - 5000,
    });

    expect(result).toEqual({ status: "ok" });
    expect(recordConsentMock).toHaveBeenCalledTimes(1);
    expect(prisma.lead.update).toHaveBeenCalledTimes(1);
  });
});
