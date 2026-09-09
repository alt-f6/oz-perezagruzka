import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  student: { findUnique: vi.fn() },
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));

const { claimFirstPaymentOffer, sendFirstPaymentOffer } = await import("./offer.service");

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.CRM_RESEND_API_KEY;
  delete process.env.CRM_NOTIFICATION_FROM_EMAIL;
  delete process.env.CRM_TELEGRAM_BOT_TOKEN;
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
});

describe("claimFirstPaymentOffer", () => {
  it("atomically flips offerSentAt null -> now and reports a win", async () => {
    const tx = { student: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } };

    const claimed = await claimFirstPaymentOffer(tx, "student_1");

    expect(claimed).toBe(true);
    expect(tx.student.updateMany).toHaveBeenCalledWith({
      where: { id: "student_1", offerSentAt: null },
      data: { offerSentAt: expect.any(Date) },
    });
  });

  it("reports a loss when offerSentAt was already set (0 rows matched)", async () => {
    const tx = { student: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };

    const claimed = await claimFirstPaymentOffer(tx, "student_1");

    expect(claimed).toBe(false);
  });
});

describe("sendFirstPaymentOffer", () => {
  it("no-ops without throwing when the student no longer exists", async () => {
    dbMock.student.findUnique.mockResolvedValue(null);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(sendFirstPaymentOffer("student_1")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips both channels silently when neither Resend nor Telegram is configured", async () => {
    dbMock.student.findUnique.mockResolvedValue({
      fullName: "Иван Иванов",
      email: "ivan@example.com",
      parents: [{ parent: { telegramChatId: "chat_1", user: { email: "parent@example.com" } } }],
    });
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await sendFirstPaymentOffer("student_1");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("emails every linked parent (Resend) and duplicates to Telegram when a chatId is on file", async () => {
    process.env.CRM_RESEND_API_KEY = "re_test";
    process.env.CRM_NOTIFICATION_FROM_EMAIL = "school@example.com";
    process.env.CRM_TELEGRAM_BOT_TOKEN = "bot_test";
    dbMock.student.findUnique.mockResolvedValue({
      fullName: "Иван Иванов",
      email: "ivan@example.com",
      parents: [
        { parent: { telegramChatId: "chat_1", user: { email: "parent@example.com" } } },
        { parent: { telegramChatId: null, user: { email: null } } },
      ],
    });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await sendFirstPaymentOffer("student_1");

    // One email (the parent with an address) + one Telegram duplicate (the
    // parent with a chatId) -- the second parent has neither and is skipped.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/botbot_test/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("falls back to the student's own email when no parent is linked", async () => {
    process.env.CRM_RESEND_API_KEY = "re_test";
    process.env.CRM_NOTIFICATION_FROM_EMAIL = "school@example.com";
    dbMock.student.findUnique.mockResolvedValue({
      fullName: "Иван Иванов",
      email: "ivan@example.com",
      parents: [],
    });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await sendFirstPaymentOffer("student_1");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("never throws when a channel fails -- both attempted independently", async () => {
    process.env.CRM_RESEND_API_KEY = "re_test";
    process.env.CRM_NOTIFICATION_FROM_EMAIL = "school@example.com";
    process.env.CRM_TELEGRAM_BOT_TOKEN = "bot_test";
    dbMock.student.findUnique.mockResolvedValue({
      fullName: "Иван Иванов",
      email: null,
      parents: [{ parent: { telegramChatId: "chat_1", user: { email: "parent@example.com" } } }],
    });
    // Email fails, Telegram succeeds -- neither should block the other, and
    // the overall call must resolve rather than reject.
    const fetchSpy = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("resend.com")) {
        return { ok: false, status: 500, text: async () => "boom" };
      }
      return { ok: true, text: async () => "" };
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(sendFirstPaymentOffer("student_1")).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
