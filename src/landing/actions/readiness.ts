"use server";

import { headers } from "next/headers";
import { Prisma, type Lead } from "@prisma/client";
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
import { formatLeadSourceNotes } from "@/landing/lib/lead-source";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("landing.readiness");

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
  const { input, sessionId, utm, attribution, examType, phone } = parsed.data;

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
      message: "Спасибо! Мы сохранили вашу заявку.",
    };
  }

  // The URL-derived `utm` only reflects the page the form was submitted on;
  // localStorage's last touch keeps the campaign when the user arrived via
  // an ad and came back later without UTM params.
  const lastTouch = attribution?.attr_last;
  const leadAttribution = {
    // No dedicated exam-type / first-touch / Metrika ClientID columns on
    // Lead - recorded as notes lines so CRM managers see them at a glance
    // without a schema migration.
    notes: [
      `Экзамен: ${examType === "ege" ? "ЕГЭ" : "ОГЭ"}`,
      ...formatLeadSourceNotes(attribution),
    ].join("\n"),
    sessionId,
    ipHash,
    utmSource: utm?.utmSource ?? lastTouch?.utm_source,
    utmMedium: utm?.utmMedium ?? lastTouch?.utm_medium,
    utmCampaign: utm?.utmCampaign ?? lastTouch?.utm_campaign,
    utmContent: utm?.utmContent ?? lastTouch?.utm_content,
    utmTerm: utm?.utmTerm ?? lastTouch?.utm_term,
    clickId: utm?.clickId ?? lastTouch?.click_id,
    referrer: utm?.referrer ?? lastTouch?.referrer,
    landingPage: utm?.landingPage ?? lastTouch?.landing_path,
  };

  let lead: Lead;
  try {
    lead = await prisma.lead.create({
      data: {
        name: input.name?.trim() || "Без имени",
        phone,
        source: "READINESS_MAP",
        status: "NEW",
        ...leadAttribution,
      },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw err;
    }

    // This phone number already belongs to another lead (e.g. a repeat quiz
    // attempt) - update that existing record with the fresh submission
    // instead of failing the whole flow.
    const existingLead = await prisma.lead.findUnique({ where: { phone } });
    if (!existingLead) {
      return { status: "error", message: "Не удалось сохранить заявку. Попробуйте ещё раз." };
    }

    lead = await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        name: input.name?.trim() || existingLead.name,
        ...leadAttribution,
      },
    });
  }

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
  }).catch((err) => logger.error("Не удалось сохранить USER log", err));

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
    logger.error("READINESS ACTION ERROR", error);

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
      message: "Наш ИИ сейчас перегружен. Мы сохранили вашу заявку — эксперт подготовит карту готовности вручную.",
    };
  }
}
