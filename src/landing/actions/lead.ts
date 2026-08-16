"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/landing/lib/db";
import { sendTelegramNotification } from "@/landing/lib/telegram";
import { checkRateLimit } from "@/landing/lib/rate-limit";
import { hashRequestHeaders } from "@/landing/lib/request-ip";
import { recordConsent } from "@/landing/lib/consent-log";
import { isLikelyBot } from "@/landing/lib/bot-defense";
import { russianPhoneSchema } from "@/shared/validation/phone";
import { LEGAL_DOCUMENT_VERSION } from "@/landing/lib/legal";

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

/**
 * Escapes user-controlled text for Telegram's HTML parse mode.
 * Only `<`, `>` and `&` are special in HTML mode, so escaping them prevents
 * both broken markup and injection of unintended tags.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Narrows an unknown JSON value to a plain record, else null. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Narrows an unknown record field to a string, else undefined. */
function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Safely parses JSON, returning `null` instead of throwing on malformed input. */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("⚠️ Ошибка парсинга JSON:", error);
    return null;
  }
}

/** Renders a string | string[] AI field into an escaped, bullet-joined string. */
function renderList(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => escapeHtml(item))
      .filter(Boolean)
      .join(" • ");
  }
  return escapeHtml(value);
}

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
    await recordConsent({
      leadId: updatedLead.id,
      consentType: "PEP_ACCEPTANCE",
      documentSlug: "pep",
      documentVersion: LEGAL_DOCUMENT_VERSION,
      ipHash,
      userAgent: hdrs.get("user-agent") ?? "unknown",
    });

    // Scope logs to BOTH the lead and its session, and always take the most
    // recent record so a repeat quiz attempt can never surface a stale log.
    const [userLog, aiLog] = await Promise.all([
      prisma.aiChatLog.findFirst({
        where: { leadId: updatedLead.id, sessionId: updatedLead.sessionId ?? undefined, role: "USER" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.aiChatLog.findFirst({
        where: { leadId: updatedLead.id, sessionId: updatedLead.sessionId ?? undefined, role: "ASSISTANT" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    let studentName = updatedLead.name;
    let grade = "Не указан";
    let subjects = "Не указаны";
    let studyStyle = "Не указано";
    let hobbies = "Не указаны";

    if (userLog?.content) {
      const parsedInput = asRecord(safeJsonParse(userLog.content));
      if (parsedInput) {
        studentName = asString(parsedInput.name) || updatedLead.name;
        grade = asString(parsedInput.grade) || "Не указан";
        subjects = asString(parsedInput.subjects) || "Не указаны";
        studyStyle = asString(parsedInput.studyStyle) || "Не указано";
        hobbies = (asString(parsedInput.hobbies) || "").split("|").join(", ") || "Не указаны";
      }
    }

    let aiSummary = "";
    let isFallback = true;

    if (aiLog) {
      isFallback = aiLog.failed;
      if (!aiLog.failed && aiLog.content) {
        const parsedContent = asRecord(safeJsonParse(aiLog.content));
        if (parsedContent) {
          const whatISee = parsedContent.whatISee
            ? `<b>Анализ личности:</b> ${escapeHtml(parsedContent.whatISee)}\n`
            : "";

          const zones = renderList(parsedContent.attentionZones);
          const attentionStr = zones ? `<b>Зоны внимания к ОГЭ:</b> ${zones}\n` : "";

          const strengths = renderList(parsedContent.strengths);
          const strengthsStr = strengths ? `<b>Сильные стороны:</b> ${strengths}\n` : "";

          aiSummary = `${whatISee}${attentionStr}${strengthsStr}`.trim();
        } else {
          aiSummary = "Карта успешно создана, но произошел сбой разметки текста лога.";
        }
      }
    }

    const resultText = isFallback
      ? "⚠️ ИИ выдал ошибку при генерации карты готовности!"
      : `<b>Балл готовности:</b> ${escapeHtml(updatedLead.readinessScore ?? "Не определен")}/100\n\n${aiSummary}`;

    const telegramMessage = [
      `🔔 <b>Новая заявка с ИИ-квиза!</b>`,
      `\n👤 <b>Имя ученика:</b> ${escapeHtml(studentName)}`,
      `🏫 <b>Класс:</b> ${escapeHtml(grade)}-й класс`,
      `📚 <b>Предметы:</b> ${escapeHtml(subjects)}`,
      `📝 <b>Стиль учёбы:</b> ${escapeHtml(studyStyle)}`,
      `🎨 <b>Увлечения:</b> ${escapeHtml(hobbies)}`,
      `📱 <b>Телефон:</b> <code>${escapeHtml(parsed.data.phone)}</code>`,
      `\n🧠 <b>Полный разбор ИИ:</b>`,
      resultText,
    ].join("\n");

    // Fire-and-forget: Telegram delivery must never block or revert the DB
    // update. The helper already swallows its own errors; this guard is a
    // belt-and-suspenders against any unexpected rejection.
    void sendTelegramNotification(telegramMessage).catch((err) => {
      console.error("🔴 Ошибка при отправке уведомления в Telegram:", err);
    });

    return { status: "ok" };
  } catch (error) {
    console.error("Ошибка в attachLeadContact:", error);
    return { status: "error", message: "Не удалось сохранить номер." };
  }
}
