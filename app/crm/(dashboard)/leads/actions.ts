"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { leadSchema, type LeadValues } from "@/crm/lib/schemas";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { performLeadConversion } from "@/crm/lib/services/lead-conversion.service";
import { LEAD_STATUS_ORDER, type ActionResult, type LeadStatus } from "@/crm/lib/types";

export async function createLead(
  values: LeadValues,
): Promise<ActionResult & { merged?: boolean }> {
  const parsed = leadSchema.safeParse({ ...values, status: "NEW" });
  if (!parsed.success) {
    return { error: "Некорректные данные заявки" };
  }

  try {
    await requireRole(["ADMIN", "MANAGER"]);
  } catch {
    return { error: "Недостаточно прав для создания заявки" };
  }

  try {
    await db.lead.create({
      data: {
        name: parsed.data.studentName,
        parentName: parsed.data.parentName || null,
        phone: parsed.data.phone,
        subject: parsed.data.subject || null,
        notes: parsed.data.notes || null,
        status: "NEW",
        utmSource: parsed.data.utmSource || null,
        utmMedium: parsed.data.utmMedium || null,
        utmCampaign: parsed.data.utmCampaign || null,
      },
    });
  } catch (err) {
    // Lead.phone is unique -- a repeat inquiry for a phone we've already
    // captured should merge into the existing lead instead of failing with
    // a raw constraint error surfaced to the user.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      try {
        await db.lead.update({
          where: { phone: parsed.data.phone },
          data: {
            name: parsed.data.studentName,
            parentName: parsed.data.parentName || null,
            subject: parsed.data.subject || null,
            notes: parsed.data.notes || null,
            utmSource: parsed.data.utmSource || null,
            utmMedium: parsed.data.utmMedium || null,
            utmCampaign: parsed.data.utmCampaign || null,
          },
        });
      } catch (mergeErr) {
        return {
          error:
            mergeErr instanceof Error
              ? mergeErr.message
              : "Заявка с этим номером телефона уже существует, но обновить её не удалось",
        };
      }

      revalidatePath("/leads");
      return { merged: true };
    }

    return {
      error: err instanceof Error ? err.message : "Ошибка создания заявки",
    };
  }

  revalidatePath("/leads");
  return {};
}

export async function updateLead(
  leadId: string,
  values: LeadValues,
): Promise<ActionResult> {
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные заявки" };
  }

  try {
    await requireRole(["ADMIN", "MANAGER"]);
  } catch {
    return { error: "Недостаточно прав для изменения заявки" };
  }

  // CONVERTED must only be reached through performLeadConversion, which
  // atomically provisions the linked User + Student. Setting it here would
  // leave convertedUserId null -- a lead marked "converted" with no student.
  const existingLead = await db.lead.findUnique({
    where: { id: leadId },
    select: { status: true },
  });
  if (parsed.data.status === "CONVERTED" && existingLead?.status !== "CONVERTED") {
    return {
      error: "Используйте конвертацию лида, чтобы перевести его в статус «Конвертирован».",
    };
  }

  try {
    await db.lead.update({
      where: { id: leadId },
      data: {
        name: parsed.data.studentName,
        parentName: parsed.data.parentName || null,
        phone: parsed.data.phone,
        subject: parsed.data.subject || null,
        notes: parsed.data.notes || null,
        status: parsed.data.status,
        closedLostReason:
          parsed.data.status === "CLOSED_LOST"
            ? parsed.data.closedLostReason || null
            : null,
        utmSource: parsed.data.utmSource || null,
        utmMedium: parsed.data.utmMedium || null,
        utmCampaign: parsed.data.utmCampaign || null,
      },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка обновления заявки",
    };
  }

  revalidatePath("/leads");
  return {};
}

export async function advanceLeadStatus(
  leadId: string,
  currentStatus: LeadStatus,
): Promise<ActionResult> {
  const currentIndex = LEAD_STATUS_ORDER.indexOf(currentStatus);
  if (currentIndex === -1 || currentIndex === LEAD_STATUS_ORDER.length - 1) {
    return { error: "Эту заявку нельзя продвинуть дальше по воронке" };
  }
  const nextStatus = LEAD_STATUS_ORDER[currentIndex + 1];

  try {
    await requireRole(["ADMIN", "MANAGER"]);
  } catch {
    return { error: "Недостаточно прав для изменения статуса" };
  }

  try {
    await db.lead.update({
      where: { id: leadId },
      data: { status: nextStatus },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка обновления статуса",
    };
  }

  revalidatePath("/leads");
  return {};
}

export async function markLeadLost(
  leadId: string,
  reason: string,
): Promise<ActionResult> {
  if (!reason.trim()) {
    return { error: "Укажите причину отказа" };
  }

  try {
    await requireRole(["ADMIN", "MANAGER"]);
  } catch {
    return { error: "Недостаточно прав для изменения заявки" };
  }

  try {
    await db.lead.update({
      where: { id: leadId },
      data: {
        status: "CLOSED_LOST",
        closedLostReason: reason.trim(),
      },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка обновления заявки",
    };
  }

  revalidatePath("/leads");
  return {};
}

export async function deleteLead(leadId: string): Promise<ActionResult> {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
  } catch {
    return { error: "Недостаточно прав для удаления заявки" };
  }

  try {
    await db.lead.delete({ where: { id: leadId } });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка удаления заявки",
    };
  }

  revalidatePath("/leads");
  return {};
}

// Payment is the funnel's "PAID" trigger: the diagnostic already happened by
// this point, so converting a lead here is the single place that must
// auto-provision the LMS side (User + Student, linked via convertedUserId)
// rather than leaving the CRM Student record disconnected from any login.
export async function convertLeadToStudent(
  leadId: string,
): Promise<ActionResult> {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
  } catch {
    return { error: "Недостаточно прав для конвертации лида" };
  }

  const result = await performLeadConversion(leadId);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/leads");
  revalidatePath("/students");
  return {};
}
