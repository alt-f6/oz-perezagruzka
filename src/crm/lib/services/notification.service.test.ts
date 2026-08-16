import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
  delete process.env.CRM_TELEGRAM_BOT_TOKEN;
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("getNotificationProvider", () => {
  it("returns a MockNotificationProvider when CRM_TELEGRAM_BOT_TOKEN is unset", async () => {
    const { getNotificationProvider, MockNotificationProvider } = await import(
      "@/crm/lib/services/notification.service"
    );

    expect(getNotificationProvider()).toBeInstanceOf(MockNotificationProvider);
  });

  it("returns a CompositeNotificationProvider wrapping Telegram when CRM_TELEGRAM_BOT_TOKEN is set", async () => {
    process.env.CRM_TELEGRAM_BOT_TOKEN = "test-bot-token";
    const { getNotificationProvider, CompositeNotificationProvider } = await import(
      "@/crm/lib/services/notification.service"
    );

    expect(getNotificationProvider()).toBeInstanceOf(CompositeNotificationProvider);
  });
});

describe("MockNotificationProvider", () => {
  it("logs via the structured logger instead of raw console.log", async () => {
    const { MockNotificationProvider } = await import("@/crm/lib/services/notification.service");
    const infoSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await new MockNotificationProvider().sendDebtReminder({ fullName: "Иван" }, -500);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ level: "info", scope: "notification-mock" });
  });
});

describe("TelegramNotificationProvider", () => {
  it("skips sending when the recipient has no telegramChatId", async () => {
    process.env.CRM_TELEGRAM_BOT_TOKEN = "test-bot-token";
    const { TelegramNotificationProvider } = await import(
      "@/crm/lib/services/notification.service"
    );
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await new TelegramNotificationProvider("test-bot-token").sendDebtReminder(
      { fullName: "Иван", telegramChatId: null },
      -500,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to the Telegram Bot API with the recipient's chat id", async () => {
    const { TelegramNotificationProvider } = await import(
      "@/crm/lib/services/notification.service"
    );
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await new TelegramNotificationProvider("test-bot-token").sendPaymentReceipt(
      { fullName: "Иван", telegramChatId: "chat_1" },
      5000,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-bot-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"chat_id":"chat_1"'),
      }),
    );
  });

  it("logs and rethrows when the Telegram API responds with a non-ok status", async () => {
    const { TelegramNotificationProvider } = await import(
      "@/crm/lib/services/notification.service"
    );
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "chat not found",
    });
    global.fetch = fetchSpy as unknown as typeof fetch;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      new TelegramNotificationProvider("test-bot-token").sendDebtReminder(
        { fullName: "Иван", telegramChatId: "chat_1" },
        -500,
      ),
    ).rejects.toThrow(/400/);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ level: "error", scope: "notification" });
  });

  it("aborts the request and rethrows a clear error when the Telegram API hangs past the timeout", async () => {
    const { TelegramNotificationProvider } = await import(
      "@/crm/lib/services/notification.service"
    );
    vi.useFakeTimers();
    const fetchSpy = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("This operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    );
    global.fetch = fetchSpy as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const pending = new TelegramNotificationProvider("test-bot-token").sendDebtReminder(
      { fullName: "Иван", telegramChatId: "chat_1" },
      -500,
    );
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;

    vi.useRealTimers();
  });
});

describe("ResendEmailProvider", () => {
  it("skips sending when the recipient has no email", async () => {
    const { ResendEmailProvider } = await import("@/crm/lib/services/notification.service");
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await new ResendEmailProvider("resend-key", "no-reply@example.com").sendDebtReminder(
      { fullName: "Иван", email: null },
      -500,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to the Resend API with the recipient's email", async () => {
    const { ResendEmailProvider } = await import("@/crm/lib/services/notification.service");
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    global.fetch = fetchSpy as unknown as typeof fetch;

    await new ResendEmailProvider("resend-key", "no-reply@example.com").sendPaymentReceipt(
      { fullName: "Иван", email: "ivan@example.com" },
      5000,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer resend-key" }),
        body: expect.stringContaining('"to":"ivan@example.com"'),
      }),
    );
  });

  it("logs, records a failure metric, and rethrows when the Resend API responds with a non-ok status", async () => {
    const { ResendEmailProvider } = await import("@/crm/lib/services/notification.service");
    const { getStats, resetMetrics } = await import("@/shared/lib/notification-metrics");
    resetMetrics();
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => "invalid recipient" });
    global.fetch = fetchSpy as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      new ResendEmailProvider("resend-key", "no-reply@example.com").sendDebtReminder(
        { fullName: "Иван", email: "ivan@example.com" },
        -500,
      ),
    ).rejects.toThrow(/422/);

    expect(getStats().channels.email.failures).toBe(1);
  });
});

describe("CompositeNotificationProvider", () => {
  it("only calls the primary provider when it succeeds", async () => {
    const { CompositeNotificationProvider } = await import("@/crm/lib/services/notification.service");
    const primary = { sendDebtReminder: vi.fn().mockResolvedValue(undefined), sendLessonReminder: vi.fn(), sendPaymentReceipt: vi.fn() };
    const fallback = { sendDebtReminder: vi.fn(), sendLessonReminder: vi.fn(), sendPaymentReceipt: vi.fn() };

    await new CompositeNotificationProvider(primary, fallback).sendDebtReminder({ fullName: "Иван" }, -500);

    expect(primary.sendDebtReminder).toHaveBeenCalledTimes(1);
    expect(fallback.sendDebtReminder).not.toHaveBeenCalled();
  });

  it("falls back to the secondary provider when the primary fails and a fallback is configured", async () => {
    const { CompositeNotificationProvider } = await import("@/crm/lib/services/notification.service");
    const primary = { sendDebtReminder: vi.fn().mockRejectedValue(new Error("telegram down")), sendLessonReminder: vi.fn(), sendPaymentReceipt: vi.fn() };
    const fallback = { sendDebtReminder: vi.fn().mockResolvedValue(undefined), sendLessonReminder: vi.fn(), sendPaymentReceipt: vi.fn() };

    await new CompositeNotificationProvider(primary, fallback).sendDebtReminder({ fullName: "Иван", email: "i@example.com" }, -500);

    expect(fallback.sendDebtReminder).toHaveBeenCalledTimes(1);
  });

  it("rethrows the primary error when the recipient has no email, even with a fallback configured, instead of treating the fallback's silent no-op as success", async () => {
    const { CompositeNotificationProvider } = await import("@/crm/lib/services/notification.service");
    const primary = { sendDebtReminder: vi.fn().mockRejectedValue(new Error("telegram down")), sendLessonReminder: vi.fn(), sendPaymentReceipt: vi.fn() };
    const fallback = { sendDebtReminder: vi.fn().mockResolvedValue(undefined), sendLessonReminder: vi.fn(), sendPaymentReceipt: vi.fn() };

    await expect(
      new CompositeNotificationProvider(primary, fallback).sendDebtReminder({ fullName: "Иван" }, -500),
    ).rejects.toThrow(/telegram down/);

    expect(fallback.sendDebtReminder).not.toHaveBeenCalled();
  });

  it("rethrows when both primary and fallback fail", async () => {
    const { CompositeNotificationProvider } = await import("@/crm/lib/services/notification.service");
    const primary = { sendDebtReminder: vi.fn().mockRejectedValue(new Error("telegram down")), sendLessonReminder: vi.fn(), sendPaymentReceipt: vi.fn() };
    const fallback = { sendDebtReminder: vi.fn().mockRejectedValue(new Error("email down")), sendLessonReminder: vi.fn(), sendPaymentReceipt: vi.fn() };

    await expect(
      new CompositeNotificationProvider(primary, fallback).sendDebtReminder({ fullName: "Иван", email: "i@example.com" }, -500),
    ).rejects.toThrow(/telegram down/);
  });

  it("rethrows the primary error immediately when there is no fallback provider", async () => {
    const { CompositeNotificationProvider } = await import("@/crm/lib/services/notification.service");
    const primary = { sendDebtReminder: vi.fn().mockRejectedValue(new Error("telegram down")), sendLessonReminder: vi.fn(), sendPaymentReceipt: vi.fn() };

    await expect(
      new CompositeNotificationProvider(primary, null).sendDebtReminder({ fullName: "Иван" }, -500),
    ).rejects.toThrow(/telegram down/);
  });
});
