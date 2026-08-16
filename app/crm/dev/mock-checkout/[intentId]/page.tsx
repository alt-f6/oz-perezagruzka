import { notFound } from "next/navigation";
import { prisma } from "@/crm/lib/prisma";
import { getPaymentMode } from "@/crm/lib/services/yookassa.service";
import { MockCheckoutClient } from "./MockCheckoutClient";

export default async function MockCheckoutPage({
  params,
}: {
  params: Promise<{ intentId: string }>;
}) {
  const { intentId } = await params;

  if (process.env.NODE_ENV === "production" || getPaymentMode() !== "mock") {
    return (
      <div className="mx-auto mt-20 max-w-md rounded-2xl border border-border bg-white p-6 text-center text-accent/60">
        Симулятор оплаты недоступен: YOOKASSA_SECRET_KEY настроен на реальный режим.
      </div>
    );
  }

  const intent = await prisma.paymentIntent.findUnique({
    where: { id: intentId },
    include: { student: { select: { fullName: true } } },
  });

  if (!intent || !intent.yookassaId.startsWith("mock_")) {
    notFound();
  }

  return (
    <MockCheckoutClient
      intentId={intent.id}
      studentName={intent.student.fullName}
      amount={Number(intent.amount)}
      status={intent.status}
    />
  );
}
