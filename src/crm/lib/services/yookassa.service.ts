import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/crm/lib/prisma";
import { getNotificationProvider } from "@/crm/lib/services/notification.service";
import { createLogger } from "@/shared/lib/logger";
import { requireSiteUrl } from "@/shared/lib/env";
import { kopecksToRubles, type Kopecks } from "@/crm/lib/money";

const log = createLogger("yookassa");

const YOOKASSA_API_URL = "https://api.yookassa.ru/v3";

interface YookassaAmount {
  value: string;
  currency: "RUB";
}

interface YookassaReceiptItem {
  description: string;
  quantity: string;
  amount: YookassaAmount;
  vat_code: number;
  payment_subject: string;
  payment_mode: string;
}

export interface YookassaPayment {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: YookassaAmount;
  metadata?: Record<string, string>;
  confirmation?: { type: string; confirmation_url?: string };
}

export type PaymentMode = "mock" | "test" | "live";

export function getPaymentMode(): PaymentMode {
  const key = process.env.YOOKASSA_SECRET_KEY;
  if (!key || key === "mock") return "mock";
  if (key.startsWith("test_")) return "test";
  if (key.startsWith("live_")) {
    if (process.env.ALLOW_LIVE_PAYMENTS !== "true") {
      throw new Error(
        "YOOKASSA_SECRET_KEY is a LIVE key. Refusing to process payments without an " +
          "explicit ALLOW_LIVE_PAYMENTS=true opt-in. Use a test_ key for local " +
          "development and staging -- see docs/payments-testing.md.",
      );
    }
    return "live";
  }
  throw new Error(
    'Unrecognized YOOKASSA_SECRET_KEY format (expected a "test_" or "live_" prefix, or "mock"/unset for local dev).',
  );
}

function authHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    throw new Error("YOOKASSA_SHOP_ID/YOOKASSA_SECRET_KEY не настроены");
  }
  return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`;
}

function buildReceiptItem(amount: Kopecks, description: string): YookassaReceiptItem {
  return {
    description,
    quantity: "1.00",
    amount: { value: kopecksToRubles(amount), currency: "RUB" },
    vat_code: 1,
    payment_subject: "service",
    payment_mode: "full_payment",
  };
}

export interface CreatePaymentSessionParams {
  studentId: string;
  studentFullName: string;
  amount: Kopecks;
  returnUrl: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface CreatePaymentSessionResult {
  confirmationUrl: string;
  paymentIntentId: string;
}

export const YookassaService = {
  async createPaymentSession({
    studentId,
    studentFullName,
    amount,
    returnUrl,
    customerEmail,
    customerPhone,
  }: CreatePaymentSessionParams): Promise<CreatePaymentSessionResult> {
    const mode = getPaymentMode();

    if (mode === "mock") {
      const domain = requireSiteUrl();
      const paymentIntent = await prisma.paymentIntent.create({
        data: {
          studentId,
          yookassaId: `mock_${randomUUID()}`,
          amount: Number(kopecksToRubles(amount)),
          status: "PENDING",
        },
      });
      const confirmationUrl = `${domain}/dev/mock-checkout/${paymentIntent.id}`;
      await prisma.paymentIntent.update({
        where: { id: paymentIntent.id },
        data: { confirmationUrl },
      });
      return { confirmationUrl, paymentIntentId: paymentIntent.id };
    }

    const description = `Пополнение баланса: ${studentFullName}`;

    const receipt: Record<string, unknown> = {
      items: [buildReceiptItem(amount, description)],
    };
    if (customerEmail || customerPhone) {
      receipt.customer = {
        ...(customerEmail ? { email: customerEmail } : {}),
        ...(customerPhone ? { phone: customerPhone } : {}),
      };
    }

    const response = await fetch(`${YOOKASSA_API_URL}/payments`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        "Idempotence-Key": randomUUID(),
      },
      body: JSON.stringify({
        amount: { value: kopecksToRubles(amount), currency: "RUB" },
        capture: true,
        confirmation: { type: "redirect", return_url: returnUrl },
        description,
        metadata: { studentId },
        receipt,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ошибка создания платежа YooKassa (${response.status}): ${body}`);
    }

    const payment = (await response.json()) as YookassaPayment;
    const confirmationUrl = payment.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      throw new Error("YooKassa не вернула ссылку на оплату");
    }

    const paymentIntent = await prisma.paymentIntent.create({
      data: {
        studentId,
        yookassaId: payment.id,
        amount: Number(kopecksToRubles(amount)),
        status: "PENDING",
        confirmationUrl,
      },
    });

    return { confirmationUrl, paymentIntentId: paymentIntent.id };
  },

  async fetchPayment(paymentId: string): Promise<YookassaPayment> {
    const response = await fetch(`${YOOKASSA_API_URL}/payments/${paymentId}`, {
      headers: { Authorization: authHeader() },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ошибка запроса платежа YooKassa (${response.status}): ${body}`);
    }
    return (await response.json()) as YookassaPayment;
  },
};

export interface FinalizeSuccessfulPaymentParams {
  paymentId: string;
  studentId: string;
  amount: Kopecks;
  description?: string;
}

export async function finalizeSuccessfulPayment({
  paymentId,
  studentId,
  amount,
  description = "Онлайн-оплата через YooKassa",
}: FinalizeSuccessfulPaymentParams): Promise<boolean> {
  const created = await prisma.$transaction(async (tx) => {
    await tx.paymentIntent.updateMany({
      where: { yookassaId: paymentId, status: "PENDING" },
      data: { status: "SUCCEEDED" },
    });

    try {
      return await tx.transaction.create({
        data: {
          studentId,
          amount: Number(kopecksToRubles(amount)),
          type: "PAYMENT",
          description,
          idempotencyKey: paymentId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return null;
      }
      throw err;
    }
  });

  if (!created) return false;

  try {
    revalidatePath("/parent/dashboard");
    revalidatePath(`/students/${studentId}`);
  } catch (err) {
    log.error("Не удалось инвалидировать кэш после оплаты", err, {
      paymentId,
      studentId,
    });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { parents: { include: { parent: { include: { user: true } } } } },
    });
    if (student) {
      const provider = getNotificationProvider();
      await Promise.all(
        student.parents.map(({ parent }) =>
          provider.sendPaymentReceipt(
            { telegramChatId: parent.telegramChatId, email: parent.user?.email, fullName: student.fullName },
            Number(kopecksToRubles(amount)),
          ),
        ),
      );
    }
  } catch (err) {
    log.error("Не удалось отправить уведомление об оплате", err, {
      paymentId,
      studentId,
    });
  }

  log.info("payment_credited", { paymentId, studentId, amount });
  return true;
}
