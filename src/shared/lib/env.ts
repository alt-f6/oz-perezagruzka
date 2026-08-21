import { z } from "zod";

// Fail-fast startup validation for env vars with no safe runtime fallback.
// Everything else in the app (YooKassa, Telegram, R2, ...) degrades to a
// mock/no-op when unset, which is fine for local dev -- but DATABASE_URL and
// COOKIE_SECRET are load-bearing for every request, so a misconfiguration
// should crash on boot instead of surfacing as a confusing 500 later.
const requiredSchema = z.object({
  DATABASE_URL: z
    .string({ message: "DATABASE_URL is required (Postgres connection string)" })
    .url("DATABASE_URL must be a valid connection string, e.g. postgresql://user:pass@host:5432/db"),
  COOKIE_SECRET: z
    .string({ message: "COOKIE_SECRET is required (session cookie HMAC signing key)" })
    .min(32, "COOKIE_SECRET must be at least 32 characters"),
});

// In dev/test these vars degrade to a mock provider (see
// notification.service.ts) or a hard cron refusal, both safe. In production
// a missing value means notifications silently no-op or the cron endpoint
// silently 500s forever, so they're required only when NODE_ENV=production.
const productionSchema = z
  .object({
    CRM_TELEGRAM_BOT_TOKEN: z.string({ message: "CRM_TELEGRAM_BOT_TOKEN is required in production" }).min(1),
    CRON_SECRET: z.string({ message: "CRON_SECRET is required in production" }).min(1),
    NEXT_PUBLIC_SITE_URL: z
      .string({ message: "NEXT_PUBLIC_SITE_URL is required in production (used to build payment return URLs)" })
      .url("NEXT_PUBLIC_SITE_URL must be a valid absolute URL, e.g. https://example.com"),
    CRM_RESEND_API_KEY: z.string().min(1).optional(),
    CRM_NOTIFICATION_FROM_EMAIL: z.string().min(1).optional(),
    YOOKASSA_SECRET_KEY: z.string().min(1).optional(),
    YOOKASSA_WEBHOOK_SECRET: z.string().min(1).optional(),
  })
  .refine((env) => !env.CRM_RESEND_API_KEY || Boolean(env.CRM_NOTIFICATION_FROM_EMAIL), {
    message: "CRM_NOTIFICATION_FROM_EMAIL is required in production when CRM_RESEND_API_KEY is set",
    path: ["CRM_NOTIFICATION_FROM_EMAIL"],
  })
  .refine(
    (env) =>
      !(env.YOOKASSA_SECRET_KEY && env.YOOKASSA_SECRET_KEY !== "mock") ||
      Boolean(env.YOOKASSA_WEBHOOK_SECRET),
    {
      message:
        "YOOKASSA_WEBHOOK_SECRET is required in production when YOOKASSA_SECRET_KEY is set to a real (non-mock) key -- without it the payment webhook falls back to a spoofable IP allowlist",
      path: ["YOOKASSA_WEBHOOK_SECRET"],
    },
  );

let validated = false;

export function validateEnv(): void {
  if (validated) return;

  const result = requiredSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatIssues(result.error.issues));
  }

  if (process.env.NODE_ENV === "production") {
    const prodResult = productionSchema.safeParse(process.env);
    if (!prodResult.success) {
      throw new Error(formatIssues(prodResult.error.issues));
    }
  }

  for (const warning of collectWarnings()) {
    console.warn(`[env] ${warning}`);
  }

  validated = true;
}

// Duck-typed against Zod's issue shape (path segments + message) instead of
// importing a version-specific issue type name, which differs across major
// Zod versions.
function formatIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  const lines = issues.map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n");
  return `Invalid or missing environment variables:\n${lines}`;
}

// Base URL used to build absolute links (e.g. YooKassa payment return URLs)
// handed off to third parties or end users. Unlike most CRM feature flags,
// there is no safe runtime fallback for this in production: a missing value
// would silently point real payment redirects at localhost, so this throws
// instead of degrading. Local/dev/test keep the localhost fallback since
// validateEnv() only enforces NEXT_PUBLIC_SITE_URL when NODE_ENV=production.
export function requireSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (url) return url;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is required in production (used to build payment return URLs) but is not set.",
    );
  }

  return "http://localhost:3000";
}

// Feature-scoped vars that have a working fallback (mock provider, disabled
// feature) but would silently misbehave in production if half-configured.
function collectWarnings(): string[] {
  const warnings: string[] = [];

  if (!process.env.CRM_TELEGRAM_BOT_TOKEN) {
    warnings.push(
      "CRM_TELEGRAM_BOT_TOKEN is not set -- CRM notifications will fall back to a logged mock provider instead of sending real Telegram messages.",
    );
  }

  const yookassaKey = process.env.YOOKASSA_SECRET_KEY;
  const isRealYookassaKey = Boolean(yookassaKey) && yookassaKey !== "mock";
  if (isRealYookassaKey) {
    if (!process.env.YOOKASSA_SHOP_ID) {
      warnings.push("YOOKASSA_SECRET_KEY is set but YOOKASSA_SHOP_ID is missing -- payments will fail at request time.");
    }
    if (!process.env.YOOKASSA_WEBHOOK_SECRET) {
      warnings.push(
        "YOOKASSA_SECRET_KEY is set but YOOKASSA_WEBHOOK_SECRET is missing -- the webhook is unauthenticated beyond the source-IP allowlist.",
      );
    }
  }

  if (!process.env.CRON_SECRET) {
    warnings.push("CRON_SECRET is not set -- /crm/api/cron/lesson-reminders will refuse every request.");
  }

  return warnings;
}
