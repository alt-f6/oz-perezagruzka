import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const REQUIRED_ENV = {
  DATABASE_URL: "postgresql://user:password@host:5432/dbname",
  COOKIE_SECRET: "a".repeat(32),
};

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv, ...REQUIRED_ENV };
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("validateEnv", () => {
  it("passes silently when all required variables are present and valid", async () => {
    const { validateEnv } = await import("@/shared/lib/env");

    expect(() => validateEnv()).not.toThrow();
  });

  it("throws a single aggregated error listing every missing/invalid variable", async () => {
    delete process.env.DATABASE_URL;
    process.env.COOKIE_SECRET = "too-short";
    const { validateEnv } = await import("@/shared/lib/env");

    let thrown: unknown;
    try {
      validateEnv();
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("COOKIE_SECRET");
  });

  it("rejects a DATABASE_URL that isn't a valid connection string", async () => {
    process.env.DATABASE_URL = "not-a-url";
    const { validateEnv } = await import("@/shared/lib/env");

    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });

  it("rejects a COOKIE_SECRET shorter than 32 characters", async () => {
    process.env.COOKIE_SECRET = "short";
    const { validateEnv } = await import("@/shared/lib/env");

    expect(() => validateEnv()).toThrow(/COOKIE_SECRET/);
  });

  it("only validates once per process (idempotent, cheap to call repeatedly)", async () => {
    const { validateEnv } = await import("@/shared/lib/env");

    expect(() => validateEnv()).not.toThrow();
    delete process.env.DATABASE_URL;
    expect(() => validateEnv()).not.toThrow();
  });

  it("warns (without throwing) when CRM_TELEGRAM_BOT_TOKEN is unset, since notifications fall back to a mock", async () => {
    delete process.env.CRM_TELEGRAM_BOT_TOKEN;
    const { validateEnv } = await import("@/shared/lib/env");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => validateEnv()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("CRM_TELEGRAM_BOT_TOKEN"));
  });

  it("warns when YOOKASSA_SECRET_KEY is a live/test key but YOOKASSA_WEBHOOK_SECRET is unset", async () => {
    process.env.YOOKASSA_SECRET_KEY = "test_abc123";
    process.env.YOOKASSA_SHOP_ID = "shop_1";
    delete process.env.YOOKASSA_WEBHOOK_SECRET;
    const { validateEnv } = await import("@/shared/lib/env");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => validateEnv()).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("YOOKASSA_WEBHOOK_SECRET"));
  });

  describe("validateEnv in production", () => {
    it("throws when CRM_TELEGRAM_BOT_TOKEN is missing in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      delete process.env.CRM_TELEGRAM_BOT_TOKEN;
      process.env.CRON_SECRET = "test-secret";
      process.env.CRM_RESEND_API_KEY = "test-resend-key";
      process.env.CRM_NOTIFICATION_FROM_EMAIL = "no-reply@example.com";
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
      process.env.COOKIE_DOMAIN = ".example.com";
      const { validateEnv } = await import("@/shared/lib/env");

      expect(() => validateEnv()).toThrow(/CRM_TELEGRAM_BOT_TOKEN/);
    });

    it("throws when CRON_SECRET is missing in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.CRM_TELEGRAM_BOT_TOKEN = "test-token";
      delete process.env.CRON_SECRET;
      process.env.CRM_RESEND_API_KEY = "test-resend-key";
      process.env.CRM_NOTIFICATION_FROM_EMAIL = "no-reply@example.com";
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
      process.env.COOKIE_DOMAIN = ".example.com";
      const { validateEnv } = await import("@/shared/lib/env");

      expect(() => validateEnv()).toThrow(/CRON_SECRET/);
    });

    it("throws when CRM_RESEND_API_KEY is set without CRM_NOTIFICATION_FROM_EMAIL in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.CRM_TELEGRAM_BOT_TOKEN = "test-token";
      process.env.CRON_SECRET = "test-secret";
      process.env.CRM_RESEND_API_KEY = "test-resend-key";
      delete process.env.CRM_NOTIFICATION_FROM_EMAIL;
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
      process.env.COOKIE_DOMAIN = ".example.com";
      const { validateEnv } = await import("@/shared/lib/env");

      expect(() => validateEnv()).toThrow(/CRM_NOTIFICATION_FROM_EMAIL/);
    });

    it("passes in production when every notification credential is present", async () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.CRM_TELEGRAM_BOT_TOKEN = "test-token";
      process.env.CRON_SECRET = "test-secret";
      process.env.CRM_RESEND_API_KEY = "test-resend-key";
      process.env.CRM_NOTIFICATION_FROM_EMAIL = "no-reply@example.com";
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
      process.env.COOKIE_DOMAIN = ".example.com";
      const { validateEnv } = await import("@/shared/lib/env");

      expect(() => validateEnv()).not.toThrow();
    });

    it("throws when COOKIE_DOMAIN is missing in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      process.env.CRM_TELEGRAM_BOT_TOKEN = "test-token";
      process.env.CRON_SECRET = "test-secret";
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
      delete process.env.COOKIE_DOMAIN;
      const { validateEnv } = await import("@/shared/lib/env");

      expect(() => validateEnv()).toThrow(/COOKIE_DOMAIN/);
    });

    it("does not require notification credentials outside production", async () => {
      vi.stubEnv("NODE_ENV", "test");
      delete process.env.CRM_TELEGRAM_BOT_TOKEN;
      delete process.env.CRON_SECRET;
      const { validateEnv } = await import("@/shared/lib/env");
      vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(() => validateEnv()).not.toThrow();
    });
  });
});
