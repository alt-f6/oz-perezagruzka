"use server";

import { getSessionUser } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import { paymentAmountSchema } from "@/crm/lib/schemas";
import { YookassaService } from "@/crm/lib/services/yookassa.service";
import { requireSiteUrl } from "@/shared/lib/env";
import type { ActionResult } from "@/crm/lib/types";

function buildReturnUrl(studentId: string): string {
  return `${requireSiteUrl()}/parent/dashboard?studentId=${studentId}`;
}

export async function createParentPaymentSession(
  studentId: string,
  values: unknown,
): Promise<ActionResult & { confirmationUrl?: string }> {
  const parsed = paymentAmountSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { error: "Требуется авторизация" };
  }

  const parent = await db.parent.findUnique({
    where: { userId: sessionUser.id },
    select: { id: true, phone: true },
  });
  if (!parent) {
    return { error: "Аккаунт родителя не найден" };
  }

  const link = await db.parentStudent.findUnique({
    where: { parentId_studentId: { parentId: parent.id, studentId } },
    select: { student: { select: { id: true, fullName: true } } },
  });

  const student = link?.student ?? null;
  if (!student) {
    return { error: "Ученик не найден среди привязанных к вашему аккаунту" };
  }

  try {
    const { confirmationUrl } = await YookassaService.createPaymentSession({
      studentId: student.id,
      studentFullName: student.fullName,
      amount: parsed.data.amount,
      returnUrl: buildReturnUrl(student.id),
      customerPhone: parent.phone,
    });
    return { confirmationUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Ошибка создания платежа" };
  }
}
