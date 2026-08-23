"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/landing/lib/db";
import { checkRateLimit } from "@/landing/lib/rate-limit";
import { hashRequestHeaders } from "@/landing/lib/request-ip";
import { recordConsent } from "@/landing/lib/consent-log";
import { isLikelyBot } from "@/landing/lib/bot-defense";
import { russianPhoneSchema } from "@/shared/validation/phone";
import { LEGAL_DOCUMENT_VERSION } from "@/landing/lib/legal";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("landing.lead");

const MAX_CONTACT_ATTEMPTS_PER_WINDOW = 5;
const CONTACT_WINDOW_MS = 60 * 60 * 1000;

const attachContactSchema = z.object({
  leadId: z.string().min(1),
  phone: russianPhoneSchema,
  consent: z.literal(true, "Необходимо согласие на обработку персональных данных"),
  honeypot: z.string().max(200).optional(),
  formRenderedAt: z.number().optional(),
});

export type AttachLeadContactResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function attachLeadContact(raw: unknown): Promise<AttachLeadContactResult> {
  const parsed = attachContactSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Проверьте номер телефона" };
  }

  const hdrs = await headers();
  const ipHash = hashRequestHeaders(hdrs);
  const rateLimit = await checkRateLimit(`lead-contact:${ipHash}`, MAX_CONTACT_ATTEMPTS_PER_WINDOW, CONTACT_WINDOW_MS);
  if (!rateLimit.success) {
    return { status: "error", message: "Слишком много попыток. Попробуйте ещё раз через час." };
  }

  if (isLikelyBot({ honeypot: parsed.data.honeypot, formRenderedAt: parsed.data.formRenderedAt })) {
    // Silent fake-success: a scraper sees the same response a real user
    // would, so it has no signal that it was caught. Return before any DB
    // writes (including recordConsent) so bot-flagged submissions leave
    // zero trace.
    return { status: "ok" };
  }

  try {
    let updatedLead;
    try {
      updatedLead = await prisma.lead.update({
        where: { id: parsed.data.leadId },
        data: { phone: parsed.data.phone, status: "CONTACTED" },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
        throw err;
      }

      // Phone already belongs to another lead (e.g. a repeat quiz attempt).
      // Merge this session's data into that existing record instead of
      // failing the whole flow.
      const [currentLead, existingLead] = await Promise.all([
        prisma.lead.findUnique({ where: { id: parsed.data.leadId } }),
        prisma.lead.findUnique({ where: { phone: parsed.data.phone } }),
      ]);

      if (!existingLead) {
        return { status: "error", message: "Не удалось сохранить номер." };
      }

      await prisma.$transaction([
        prisma.aiChatLog.updateMany({
          where: { leadId: parsed.data.leadId },
          data: { leadId: existingLead.id },
        }),
        prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            status: "CONTACTED",
            name: currentLead?.name ?? existingLead.name,
            sessionId: currentLead?.sessionId ?? existingLead.sessionId,
            readinessScore: currentLead?.readinessScore ?? existingLead.readinessScore,
            subject: existingLead.subject ?? currentLead?.subject ?? null,
            notes: existingLead.notes ?? currentLead?.notes ?? null,
          },
        }),
        prisma.lead.delete({ where: { id: parsed.data.leadId } }),
      ]);

      updatedLead = await prisma.lead.findUniqueOrThrow({ where: { id: existingLead.id } });
    }

    // Record consent against whichever lead row actually survives (the
    // direct update, or the merged existingLead if a phone-dedup merge
    // happened above) so the audit trail always attaches to a live lead.
    try {
      await recordConsent({
        leadId: updatedLead.id,
        consentType: "PEP_ACCEPTANCE",
        documentSlug: "pep",
        documentVersion: LEGAL_DOCUMENT_VERSION,
        ipHash,
        userAgent: hdrs.get("user-agent") ?? "unknown",
      });
    } catch (err) {
      logger.error("consent_log_write_failed", err);
      return { status: "error", message: "Не удалось сохранить согласие, попробуйте ещё раз." };
    }

    return { status: "ok" };
  } catch (error) {
    logger.error("Ошибка в attachLeadContact", error);
    return { status: "error", message: "Не удалось сохранить номер." };
  }
}
