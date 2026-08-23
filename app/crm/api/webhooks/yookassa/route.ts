import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/crm/lib/prisma";
import {
  finalizeSuccessfulPayment,
  YookassaService,
} from "@/crm/lib/services/yookassa.service";
import { rublesToKopecks } from "@/crm/lib/money";
import { checkRateLimit } from "@/landing/lib/rate-limit";
import { extractClientIp, hashIp } from "@/landing/lib/request-ip";
import { createLogger } from "@/shared/lib/logger";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

interface YookassaNotification {
  event: string;
  object: { id: string };
}

// Documented YooKassa notification source ranges:
// https://yookassa.ru/developers/using-api/webhooks#ip
const YOOKASSA_IPV4_RANGES: Array<[string, number]> = [
  ["185.71.76.0", 27],
  ["185.71.77.0", 27],
  ["77.75.153.0", 25],
  ["77.75.156.11", 32],
  ["77.75.156.35", 32],
  ["77.75.154.128", 25],
];
const YOOKASSA_IPV6_PREFIX = "2a02:5180:"; // 2a02:5180::/32

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function isYookassaIp(ip: string): boolean {
  if (ip.toLowerCase().startsWith(YOOKASSA_IPV6_PREFIX)) return true;

  const addr = ipv4ToInt(ip);
  if (addr === null) return false;

  return YOOKASSA_IPV4_RANGES.some(([base, bits]) => {
    const baseInt = ipv4ToInt(base);
    if (baseInt === null) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((addr & mask) >>> 0) === ((baseInt & mask) >>> 0);
  });
}

function secretMatches(request: Request, secret: string): boolean {
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("secret") ||
    // YooKassa supports Basic-auth credentials embedded in the webhook URL;
    // they arrive as an Authorization header.
    (() => {
      const auth = request.headers.get("authorization");
      if (!auth?.startsWith("Basic ")) return null;
      try {
        const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
        return decoded.split(":").pop() ?? null;
      } catch {
        return null;
      }
    })();

  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const log = createLogger("yookassa-webhook");

function logWebhook(entry: Record<string, unknown>) {
  log.info("notification", entry);
}

export const POST = withApiErrors(async (request) => {
  const ip = extractClientIp(request.headers);

  const rate = await checkRateLimit(
    `yookassa-webhook:${hashIp(ip)}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!rate.success) {
    logWebhook({ outcome: "rate_limited", ip });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Mock mode (local dev) has no real YooKassa traffic. Once a real API key
  // is configured, the webhook secret becomes mandatory: it must never
  // silently degrade to relying solely on the source-IP allowlist, which
  // trusts x-forwarded-for and is spoofable behind a misconfigured proxy.
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  const realPaymentMode = Boolean(secretKey) && secretKey !== "mock";
  const webhookSecret = process.env.YOOKASSA_WEBHOOK_SECRET;

  if (realPaymentMode && !webhookSecret) {
    log.error(
      "YOOKASSA_WEBHOOK_SECRET is not configured while YOOKASSA_SECRET_KEY is a real key -- refusing to process the webhook unauthenticated",
      undefined,
      { ip },
    );
    logWebhook({ outcome: "misconfigured_no_secret", ip });
    return NextResponse.json({ error: "Webhook misconfigured" }, { status: 500 });
  }

  if (webhookSecret && !secretMatches(request, webhookSecret)) {
    logWebhook({ outcome: "secret_mismatch", ip });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipCheckDisabled = process.env.YOOKASSA_WEBHOOK_SKIP_IP_CHECK === "true";
  if (realPaymentMode && !ipCheckDisabled && !isYookassaIp(ip)) {
    logWebhook({ outcome: "ip_rejected", ip });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let notification: YookassaNotification;
  try {
    notification = await request.json();
  } catch {
    logWebhook({ outcome: "invalid_json", ip });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paymentId = notification?.object?.id;
  if (!paymentId) {
    logWebhook({ outcome: "missing_payment_id", ip, event: notification?.event });
    return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
  }

  let payment;
  try {
    payment = await YookassaService.fetchPayment(paymentId);
  } catch (err) {
    log.error("Failed to verify YooKassa payment", err, { paymentId });
    logWebhook({
      outcome: "verification_failed",
      ip,
      paymentId,
      event: notification.event,
    });
    return NextResponse.json({ error: "Verification failed" }, { status: 502 });
  }

  const paymentIntent = await prisma.paymentIntent.findUnique({
    where: { yookassaId: paymentId },
  });

  if (payment.status === "canceled") {
    if (paymentIntent && paymentIntent.status === "PENDING") {
      await prisma.paymentIntent.update({
        where: { yookassaId: paymentId },
        data: { status: "CANCELED" },
      });
    }
    logWebhook({
      outcome: "canceled",
      paymentId,
      event: notification.event,
      status: payment.status,
    });
    return NextResponse.json({ ok: true });
  }

  if (payment.status !== "succeeded" || !payment.paid) {
    logWebhook({
      outcome: "ignored_status",
      paymentId,
      event: notification.event,
      status: payment.status,
    });
    return NextResponse.json({ ok: true });
  }

  const studentId = paymentIntent?.studentId ?? payment.metadata?.studentId;
  if (!studentId) {
    log.error("YooKassa payment succeeded without a resolvable studentId", undefined, {
      paymentId,
    });
    logWebhook({
      outcome: "unresolvable_student",
      paymentId,
      event: notification.event,
    });
    return NextResponse.json(
      { error: "Unresolvable student" },
      { status: 422 },
    );
  }

  const credited = await finalizeSuccessfulPayment({
    paymentId,
    studentId,
    amount: rublesToKopecks(Number(payment.amount.value)),
  });

  logWebhook({
    outcome: credited ? "credited" : "duplicate_ignored",
    paymentId,
    event: notification.event,
    status: payment.status,
    studentId,
  });

  return NextResponse.json({ ok: true });
});
