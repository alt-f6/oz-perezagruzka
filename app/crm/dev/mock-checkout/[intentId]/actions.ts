"use server";

import { prisma } from "@/crm/lib/prisma";
import { finalizeSuccessfulPayment, getPaymentMode } from "@/crm/lib/services/yookassa.service";
import { requireSessionUser } from "@/shared/lib/auth";
import type { ActionResult } from "@/crm/lib/types";

async function assertMockToolAllowed(): Promise<ActionResult> {
  if (process.env.NODE_ENV === "production") {
    return { error: "Симулятор недоступен в production" };
  }
  if (getPaymentMode() !== "mock") {
    return {
      error: "YOOKASSA_SECRET_KEY указывает на реальный режим (test/live) — симулятор отключён",
    };
  }
  try {
    await requireSessionUser(["ADMIN", "MANAGER"]);
  } catch {
    return { error: "Требуется авторизация" };
  }
  return {};
}

async function loadMockIntent(intentId: string) {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent || !intent.yookassaId.startsWith("mock_")) {
    return null;
  }
  return intent;
}

export async function simulateMockPaymentSucceeded(intentId: string): Promise<ActionResult> {
  const guard = await assertMockToolAllowed();
  if (guard.error) return guard;

  const intent = await loadMockIntent(intentId);
  if (!intent) return { error: "Тестовый платёж не найден" };
  if (intent.status !== "PENDING") return { error: "Платёж уже обработан" };

  await finalizeSuccessfulPayment({
    paymentId: intent.yookassaId,
    studentId: intent.studentId,
    amount: Number(intent.amount),
    description: "Тестовая оплата (mock YooKassa)",
  });

  return {};
}

export async function simulateMockPaymentCanceled(intentId: string): Promise<ActionResult> {
  const guard = await assertMockToolAllowed();
  if (guard.error) return guard;

  const intent = await loadMockIntent(intentId);
  if (!intent) return { error: "Тестовый платёж не найден" };
  if (intent.status !== "PENDING") return { error: "Платёж уже обработан" };

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { status: "CANCELED" },
  });

  return {};
}
