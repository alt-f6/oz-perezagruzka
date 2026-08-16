import { createLogger } from "@/shared/lib/logger";
import { recordFailure } from "@/shared/lib/notification-metrics";

export interface NotificationRecipient {
  telegramChatId?: string | null;
  email?: string | null;
  fullName: string;
}

export interface NotificationProvider {
  sendDebtReminder(recipient: NotificationRecipient, balance: number): Promise<void>;
  sendLessonReminder(
    recipient: NotificationRecipient,
    lessonInfo: { groupName: string; scheduledAt: Date },
  ): Promise<void>;
  sendPaymentReceipt(recipient: NotificationRecipient, amount: number): Promise<void>;
}

function formatRub(amount: number): string {
  return `${amount.toLocaleString("ru-RU")} ₽`;
}

const log = createLogger("notification");

// Telegram's own API rarely hangs, but a stalled TCP connection would
// otherwise block the caller (e.g. the lesson-reminders cron loop)
// indefinitely, so every send is bounded.
const TELEGRAM_SEND_TIMEOUT_MS = 10_000;

export class TelegramNotificationProvider implements NotificationProvider {
  private readonly botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  private async send(chatId: string, text: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TELEGRAM_SEND_TIMEOUT_MS);
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Ошибка отправки Telegram-уведомления (${response.status}): ${body}`);
      }
    } catch (err) {
      // Logged here (in addition to any try/catch at the call site) so a
      // delivery failure is always observable even from callers that don't
      // wrap the send in their own logging.
      log.error("telegram_send_failed", err, { chatId });
      recordFailure("telegram", err instanceof Error ? err.message : String(err));
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendDebtReminder(recipient: NotificationRecipient, balance: number): Promise<void> {
    if (!recipient.telegramChatId) return;
    await this.send(
      recipient.telegramChatId,
      `⚠️ У ${recipient.fullName} отрицательный баланс: <b>${formatRub(balance)}</b>. Пожалуйста, пополните счёт.`,
    );
  }

  async sendLessonReminder(
    recipient: NotificationRecipient,
    lessonInfo: { groupName: string; scheduledAt: Date },
  ): Promise<void> {
    if (!recipient.telegramChatId) return;
    await this.send(
      recipient.telegramChatId,
      `🔔 Напоминание: у ${recipient.fullName} занятие «${lessonInfo.groupName}» ${lessonInfo.scheduledAt.toLocaleString("ru-RU")}.`,
    );
  }

  async sendPaymentReceipt(recipient: NotificationRecipient, amount: number): Promise<void> {
    if (!recipient.telegramChatId) return;
    await this.send(
      recipient.telegramChatId,
      `✅ Оплата на сумму <b>${formatRub(amount)}</b> для ${recipient.fullName} прошла успешно.`,
    );
  }
}

const RESEND_SEND_TIMEOUT_MS = 10_000;

export class ResendEmailProvider implements NotificationProvider {
  private readonly apiKey: string;
  private readonly fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESEND_SEND_TIMEOUT_MS);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ from: this.fromEmail, to, subject, html }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Ошибка отправки email-уведомления (${response.status}): ${body}`);
      }
    } catch (err) {
      log.error("email_send_failed", err, { to });
      recordFailure("email", err instanceof Error ? err.message : String(err));
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendDebtReminder(recipient: NotificationRecipient, balance: number): Promise<void> {
    if (!recipient.email) return;
    await this.send(
      recipient.email,
      "Отрицательный баланс",
      `У ${recipient.fullName} отрицательный баланс: <b>${formatRub(balance)}</b>. Пожалуйста, пополните счёт.`,
    );
  }

  async sendLessonReminder(
    recipient: NotificationRecipient,
    lessonInfo: { groupName: string; scheduledAt: Date },
  ): Promise<void> {
    if (!recipient.email) return;
    await this.send(
      recipient.email,
      "Напоминание о занятии",
      `У ${recipient.fullName} занятие «${lessonInfo.groupName}» ${lessonInfo.scheduledAt.toLocaleString("ru-RU")}.`,
    );
  }

  async sendPaymentReceipt(recipient: NotificationRecipient, amount: number): Promise<void> {
    if (!recipient.email) return;
    await this.send(
      recipient.email,
      "Оплата получена",
      `Оплата на сумму <b>${formatRub(amount)}</b> для ${recipient.fullName} прошла успешно.`,
    );
  }
}

// Tries the primary channel first; only attempts the fallback channel when
// the primary throws. Both channels already record their own failures via
// notification-metrics, so this class doesn't duplicate that -- it just
// decides whether to retry on a different channel and what to surface to
// the caller.
export class CompositeNotificationProvider implements NotificationProvider {
  constructor(
    private readonly primary: NotificationProvider,
    private readonly fallback: NotificationProvider | null,
  ) {}

  private async dispatch<Args extends unknown[]>(
    method: (provider: NotificationProvider, recipient: NotificationRecipient, ...args: Args) => Promise<void>,
    recipient: NotificationRecipient,
    ...args: Args
  ): Promise<void> {
    try {
      await method(this.primary, recipient, ...args);
    } catch (primaryErr) {
      // A fallback provider resolves without throwing when the recipient
      // has no address on its channel (e.g. no email on file) -- that's a
      // silent no-op, not a delivery, so it must not be treated as having
      // covered the primary failure.
      if (!this.fallback || !recipient.email) throw primaryErr;
      try {
        await method(this.fallback, recipient, ...args);
      } catch {
        // Surface the primary channel's error -- it's the one operators
        // configured as the default and should investigate first.
        throw primaryErr;
      }
    }
  }

  async sendDebtReminder(recipient: NotificationRecipient, balance: number): Promise<void> {
    await this.dispatch((p, r, b) => p.sendDebtReminder(r, b), recipient, balance);
  }

  async sendLessonReminder(
    recipient: NotificationRecipient,
    lessonInfo: { groupName: string; scheduledAt: Date },
  ): Promise<void> {
    await this.dispatch((p, r, l) => p.sendLessonReminder(r, l), recipient, lessonInfo);
  }

  async sendPaymentReceipt(recipient: NotificationRecipient, amount: number): Promise<void> {
    await this.dispatch((p, r, a) => p.sendPaymentReceipt(r, a), recipient, amount);
  }
}

const mockLog = createLogger("notification-mock");

export class MockNotificationProvider implements NotificationProvider {
  async sendDebtReminder(recipient: NotificationRecipient, balance: number): Promise<void> {
    mockLog.info("debt_reminder", { fullName: recipient.fullName, balance: formatRub(balance) });
  }

  async sendLessonReminder(
    recipient: NotificationRecipient,
    lessonInfo: { groupName: string; scheduledAt: Date },
  ): Promise<void> {
    mockLog.info("lesson_reminder", {
      fullName: recipient.fullName,
      groupName: lessonInfo.groupName,
      scheduledAt: lessonInfo.scheduledAt.toISOString(),
    });
  }

  async sendPaymentReceipt(recipient: NotificationRecipient, amount: number): Promise<void> {
    mockLog.info("payment_receipt", { fullName: recipient.fullName, amount: formatRub(amount) });
  }
}

let cachedProvider: NotificationProvider | null = null;

export function getNotificationProvider(): NotificationProvider {
  if (cachedProvider) return cachedProvider;
  // Renamed from the shared `TELEGRAM_BOT_TOKEN` to an app-scoped var: the
  // landing sub-app has its own bot/token (`LANDING_TELEGRAM_BOT_TOKEN`), so
  // a single shared name would collide when both are deployed together.
  const botToken = process.env.CRM_TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    cachedProvider = new MockNotificationProvider();
    return cachedProvider;
  }

  const resendKey = process.env.CRM_RESEND_API_KEY;
  const fromEmail = process.env.CRM_NOTIFICATION_FROM_EMAIL;
  const fallback = resendKey && fromEmail ? new ResendEmailProvider(resendKey, fromEmail) : null;

  cachedProvider = new CompositeNotificationProvider(new TelegramNotificationProvider(botToken), fallback);
  return cachedProvider;
}
