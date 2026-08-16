import { db } from "@/shared/lib/db";

export interface LeadConversionResult {
  error?: string;
}

// Converts a lead into a STUDENT user + Student profile atomically.
// Authorization is the caller's responsibility (server action layer).
export async function performLeadConversion(
  leadId: string,
): Promise<LeadConversionResult> {
  const lead = await db.lead.findUnique({ where: { id: leadId } });

  if (!lead) {
    return { error: "Не удалось найти данные лида для конвертации." };
  }

  if (lead.convertedUserId) {
    return { error: "Этот лид уже конвертирован в студента." };
  }

  const existingStudent = lead.phone
    ? await db.student.findUnique({
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

  try {
    await db.$transaction(async (tx) => {
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
    });
  } catch (err) {
    return {
      error: `Ошибка при конвертации лида: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return {};
}
