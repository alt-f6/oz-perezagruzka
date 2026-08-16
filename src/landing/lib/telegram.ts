const BOT_TOKEN = process.env.LANDING_TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

type TelegramParseMode = "HTML" | "Markdown" | "MarkdownV2";

interface SendTelegramOptions {
  parseMode?: TelegramParseMode;
  disableWebPagePreview?: boolean;
}

/**
 * Sends a message to the configured Telegram chat.
 *
 * This helper NEVER throws: any misconfiguration, network failure, or API
 * error is caught and logged so that callers (e.g. lead capture) can fire it
 * without awaiting and without risking their own control flow.
 */
export async function sendTelegramNotification(
  message: string,
  options: SendTelegramOptions = {},
): Promise<void> {
  const { parseMode = "HTML", disableWebPagePreview = true } = options;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn("⚠️ Telegram credentials missing.");
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: disableWebPagePreview,
      }),
    });

    if (!response.ok) {
      // Never log the raw error body: Telegram's API can echo back a
      // fragment of the rejected message (which embeds the lead's name and
      // phone) inside its description, e.g. on "message too long" errors.
      const errorData = await response.json().catch(() => null);
      const description =
        errorData && typeof errorData === "object" && "description" in errorData
          ? String((errorData as { description?: unknown }).description).slice(0, 120)
          : response.statusText;
      console.error("❌ Ошибка отправки в Telegram:", { status: response.status, description });
    }
  } catch (error) {
    console.error("❌ Ошибка сети Telegram:", error);
  }
}
