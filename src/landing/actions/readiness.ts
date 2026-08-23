"use server";

import { headers } from "next/headers";
import { prisma } from "@/landing/lib/db";
import { checkRateLimit } from "@/landing/lib/rate-limit";
import { hashRequestHeaders } from "@/landing/lib/request-ip";
import { recordConsent } from "@/landing/lib/consent-log";
import { generateReadinessMap } from "@/landing/lib/ai/readiness-service";
import { isLikelyBot } from "@/landing/lib/bot-defense";
import {
  readinessActionInputSchema,
  type ReadinessOutput,
} from "@/landing/lib/validations/readiness";
import { LEGAL_DOCUMENT_VERSION } from "@/landing/lib/legal";

const MAX_SUBMISSIONS_PER_WINDOW = 3;
const WINDOW_MS = 60 * 60 * 1000;

export type ReadinessActionResult =
  | { status: "success"; leadId: string; map: ReadinessOutput }
  | { status: "fallback"; leadId: string; message: string }
  | { status: "error"; message: string };

export async function submitReadinessMap(
  rawInput: unknown,
): Promise<ReadinessActionResult> {
  const parsed = readinessActionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { status: "error", message: "Проверьте заполненные поля и попробуйте снова." };
  }
  const { input, sessionId, utm, examType } = parsed.data;

  const hdrs = await headers();
  const ipHash = hashRequestHeaders(hdrs);

  const rateLimitKey = `readiness:${ipHash}`;
  const rateLimit = await checkRateLimit(rateLimitKey, MAX_SUBMISSIONS_PER_WINDOW, WINDOW_MS);
  if (!rateLimit.success) {
    return {
      status: "error",
      message: "Слишком много попыток. Попробуйте ещё раз через час или напишите нам напрямую.",
    };
  }

  if (isLikelyBot({ honeypot: parsed.data.honeypot, formRenderedAt: parsed.data.formRenderedAt })) {
    // Silent fake-success shaped like the real fallback path — a scraper
    // gets a plausible response with no signal it was caught, and no DB
    // write or AI call happens.
    return {
      status: "fallback",
      leadId: "bot-detected",
      message:
        "Спасибо! Мы сохранили вашу заявку — оставьте WhatsApp, и наш эксперт пришлёт карту готовности лично.",
    };
  }

  const lead = await prisma.lead.create({
    data: {
      name: input.name?.trim() || "Без имени",
      source: "READINESS_MAP",
      status: "NEW",
      // No dedicated exam-type column on Lead - recorded as a notes prefix
      // so CRM managers see it at a glance without a schema migration.
      notes: `Экзамен: ${examType === "ege" ? "ЕГЭ" : "ОГЭ"}`,
      sessionId,
      ipHash,
      utmSource: utm?.utmSource,
      utmMedium: utm?.utmMedium,
      utmCampaign: utm?.utmCampaign,
      utmContent: utm?.utmContent,
      utmTerm: utm?.utmTerm,
      clickId: utm?.clickId,
      referrer: utm?.referrer,
      landingPage: utm?.landingPage,
    },
  });

  await recordConsent({
    leadId: lead.id,
    consentType: "PRIVACY_POLICY",
    documentSlug: "privacy",
    documentVersion: LEGAL_DOCUMENT_VERSION,
    ipHash,
    userAgent: hdrs.get("user-agent") ?? "unknown",
  });

  await prisma.aiChatLog.create({
    data: {
      sessionId,
      leadId: lead.id,
      feature: "READINESS_MAP",
      role: "USER",
      content: JSON.stringify(input),
      model: "USER_INPUT",
      latencyMs: 0,
      failed: false,
    },
  }).catch((err) => console.error("⚠️ Не удалось сохранить USER log:", err));

  try {
    const { output, model, latencyMs } = await generateReadinessMap(input);

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { readinessScore: output.readinessScore },
      }),
      prisma.aiChatLog.create({
        data: {
          sessionId,
          leadId: lead.id,
          feature: "READINESS_MAP",
          role: "ASSISTANT",
          content: JSON.stringify(output),
          model,
          latencyMs,
          failed: false,
        },
      }),
    ]);

    return { status: "success", leadId: lead.id, map: output };
  } catch (error) {
    console.error("🔴 [READINESS ACTION ERROR]:", error);

    await prisma.aiChatLog.create({
      data: {
        sessionId,
        leadId: lead.id,
        feature: "READINESS_MAP",
        role: "ASSISTANT",
        content: "",
        failed: true,
        errorMessage: error instanceof Error ? error.message : "Unknown AI error",
      },
    });

    return {
      status: "fallback",
      leadId: lead.id,
      message:
        "Наш ИИ сейчас перегружен. Мы сохранили вашу заявку — оставьте WhatsApp, и наш эксперт пришлёт карту готовности лично.",
    };
  }
}
