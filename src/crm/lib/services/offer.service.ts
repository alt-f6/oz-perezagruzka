import { db } from "@/shared/lib/db";
import { createLogger } from "@/shared/lib/logger";
import { recordFailure } from "@/shared/lib/notification-metrics";
import { OFFER_URL } from "@/crm/lib/offerLink";

export { OFFER_URL };

const log = createLogger("offer");

const RESEND_SEND_TIMEOUT_MS = 10_000;
const TELEGRAM_SEND_TIMEOUT_MS = 10_000;

// Deliberately minimal (not the full Prisma transaction-client type): this is
// called from several different transactions (YooKassa webhook, manual admin
// credit) that only need to share this one operation.
interface ClaimTx {
  student: {
    updateMany(args: {
      where: { id: string; offerSentAt: null };
      data: { offerSentAt: Date };
    }): Promise<{ count: number }>;
  };
}

/**
 * Idempotently claims the "first payment" moment for a student, meant to be
 * called from INSIDE the same DB transaction that credits the payment.
 * Atomically flips offerSentAt from null -> now with a single conditional
 * UPDATE, so two concurrent successful-payment paths (e.g. a retried
 * webhook racing a manual credit) can never both win. Returns true for
 * whichever caller wins the race -- the caller should fire
 * sendFirstPaymentOffer only when this returns true, and only AFTER the
 * transaction commits (never inside it: an external network call has no
 * place inside a DB transaction).
 */
export async function claimFirstPaymentOffer(tx: ClaimTx, studentId: string): Promise<boolean> {
  const { count } = await tx.student.updateMany({
    where: { id: studentId, offerSentAt: null },
    data: { offerSentAt: new Date() },
  });
  return count === 1;
}

async function sendOfferEmail(to: string, fullName: string): Promise<void> {
  const apiKey = process.env.CRM_RESEND_API_KEY;
  const fromEmail = process.env.CRM_NOTIFICATION_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    log.info("offer_email_skipped_unconfigured", { to });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_SEND_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject: "Договор оферты",
        html:
          `Здравствуйте, ${fullName}!<br>Спасибо за первую оплату. Пожалуйста, ` +
          `ознакомьтесь с договором оферты: <a href="${OFFER_URL}">${OFFER_URL}</a>`,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ошибка отправки оферты по email (${response.status}): ${body}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function sendOfferTelegram(chatId: string, fullName: string): Promise<void> {
  const botToken = process.env.CRM_TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    log.info("offer_telegram_skipped_unconfigured", { chatId });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_SEND_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Здравствуйте, ${fullName}! Спасибо за первую оплату. Договор оферты: ${OFFER_URL}`,
        parse_mode: "HTML",
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ошибка отправки оферты в Telegram (${response.status}): ${body}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fires the first-payment offer to every parent linked to the student (or
 * the student's own email when no parent is linked). Email (Resend) is the
 * primary channel; Telegram is an independent DUPLICATE sent whenever a
 * parent has a telegramChatId on file -- not a fallback, both are attempted
 * regardless of the other's outcome. Every failure is only ever logged, so a
 * notification-provider outage can never roll back the financial credit
 * that triggered this call. Call this AFTER the crediting transaction has
 * committed, only when claimFirstPaymentOffer returned true.
 */
export async function sendFirstPaymentOffer(studentId: string): Promise<void> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      fullName: true,
      email: true,
      parents: {
        select: {
          parent: { select: { telegramChatId: true, user: { select: { email: true } } } },
        },
      },
    },
  });
  if (!student) return;

  const recipients =
    student.parents.length > 0
      ? student.parents.map(({ parent }) => ({
          email: parent.user?.email ?? null,
          telegramChatId: parent.telegramChatId,
        }))
      : [{ email: student.email, telegramChatId: null as string | null }];

  const tasks: Promise<void>[] = [];
  for (const recipient of recipients) {
    if (recipient.email) {
      tasks.push(
        sendOfferEmail(recipient.email, student.fullName).catch((err) => {
          log.error("offer_email_failed", err, { studentId });
          recordFailure("email", err instanceof Error ? err.message : String(err));
        }),
      );
    }
    if (recipient.telegramChatId) {
      tasks.push(
        sendOfferTelegram(recipient.telegramChatId, student.fullName).catch((err) => {
          log.error("offer_telegram_failed", err, { studentId });
          recordFailure("telegram", err instanceof Error ? err.message : String(err));
        }),
      );
    }
  }

  await Promise.all(tasks);
}
