import { db } from "@/shared/lib/db";

export interface LeadConversionResult {
  error?: string;
}

interface LockedLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  convertedUserId: string | null;
}

// Converts a lead into a STUDENT user + Student profile atomically.
// Authorization is the caller's responsibility (server action layer).
//
// All duplicate-checks and writes run inside a single transaction, with the
// Lead row locked via SELECT ... FOR UPDATE first. Without the lock, two
// concurrent conversions of the same lead could both pass the
// convertedUserId/phone checks and each create a User + Student before
// either commits (a TOCTOU race producing duplicate student records).
export async function performLeadConversion(
  leadId: string,
): Promise<LeadConversionResult> {
  try {
    return await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<LockedLead[]>`
        SELECT id, name, phone, email, "convertedUserId"
        FROM "Lead"
        WHERE id = ${leadId}
        FOR UPDATE
      `;
      const lead = locked[0];

      if (!lead) {
        return { error: "Не удалось найти данные лида для конвертации." };
      }

      if (lead.convertedUserId) {
        return { error: "Этот лид уже конвертирован в студента." };
      }

      const existingStudent = lead.phone
        ? await tx.student.findUnique({
            where: { phone: lead.phone },
            select: { id: true },
          })
        : null;

      if (existingStudent) {
        return {
          error:
            "Студент с таким номером телефона уже существует. Свяжите лида со студентом вручную вместо конвертации.",
        };
      }

      const user = await tx.user.create({
        data: {
          fullName: lead.name,
          phone: lead.phone,
          email: lead.email,
          role: "STUDENT",
        },
      });

      await tx.student.create({
        data: {
          fullName: lead.name,
          phone: lead.phone,
          userId: user.id,
        },
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { status: "CONVERTED", convertedUserId: user.id },
      });

      return {};
    });
  } catch (err) {
    return {
      error: `Ошибка при конвертации лида: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
