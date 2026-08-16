import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
vi.mock("@/landing/lib/db", () => ({
  prisma: { consentLog: { create: (...args: unknown[]) => createMock(...args) } },
}));

describe("recordConsent", () => {
  // vi.resetAllMocks() clears both call history and configured
  // implementations/return values (e.g. mockResolvedValue/mockRejectedValue)
  // on every mock, equivalent to calling .mockReset() on each one — so each
  // test below must configure its own return value before use.
  beforeEach(() => vi.resetAllMocks());

  it("persists a ConsentLog row with the given fields", async () => {
    createMock.mockResolvedValue({});
    const { recordConsent } = await import("./consent-log");

    await recordConsent({
      leadId: "lead-1",
      consentType: "PRIVACY_POLICY",
      documentVersion: "2026-08-15",
      ipHash: "abc123",
      userAgent: "test-agent",
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        leadId: "lead-1",
        consentType: "PRIVACY_POLICY",
        documentVersion: "2026-08-15",
        ipHash: "abc123",
        userAgent: "test-agent",
      },
    });
  });

  it("swallows DB errors instead of throwing", async () => {
    createMock.mockRejectedValue(new Error("db down"));
    const { recordConsent } = await import("./consent-log");

    await expect(
      recordConsent({
        consentType: "PRIVACY_POLICY",
        documentVersion: "2026-08-15",
        ipHash: "abc123",
        userAgent: "test-agent",
      }),
    ).resolves.toBeUndefined();
  });
});
