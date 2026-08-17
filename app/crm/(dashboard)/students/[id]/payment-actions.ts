"use server";

import { db } from "@/shared/lib/db";
import { getSessionUser } from "@/shared/lib/auth";
import { paymentAmountSchema } from "@/crm/lib/schemas";
import { YookassaService } from "@/crm/lib/services/yookassa.service";
import { requireSiteUrl } from "@/shared/lib/env";
import type { ActionResult } from "@/crm/lib/types";

function buildReturnUrl(studentId: string): string {
  return `${requireSiteUrl()}/students/${studentId}`;
}

async function requireStaff() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { error: "Требуется авторизация" } as const;
  }

  if (!["ADMIN"].includes(sessionUser.role)) {
    return { error: "У вас нет прав для создания платежа" } as const;
  }

  return { user: sessionUser } as const;
}

export async function createStudentPaymentSession(
  studentId: string,
  values: unknown,
): Promise<ActionResult & { confirmationUrl?: string }> {
  const parsed = paymentAmountSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const auth = await requireStaff();
  if ("error" in auth) return auth;

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, fullName: true, phone: true },
  });
  if (!student) {
    return { error: "Ученик не найден" };
  }

  try {
    const { confirmationUrl } = await YookassaService.createPaymentSession({
      studentId: student.id,
      studentFullName: student.fullName,
      amount: parsed.data.amount,
      returnUrl: buildReturnUrl(student.id),
      customerPhone: student.phone ?? undefined,
    });
    return { confirmationUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Ошибка создания платежа" };
  }
}
