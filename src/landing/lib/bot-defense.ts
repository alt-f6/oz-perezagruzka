export const MIN_SUBMIT_DELAY_MS = 1500;

export interface BotCheckInput {
  honeypot?: string;
  formRenderedAt?: number;
}

/**
 * Server-side honeypot + time-trap check. `honeypot` is a hidden field real
 * users never see or fill; `formRenderedAt` is a client timestamp captured
 * on mount, so a submission faster than a human can plausibly fill the form
 * is flagged too. Both checks run here (not just client-side) so a direct
 * POST bypassing the browser JS is still caught.
 */
export function isLikelyBot(input: BotCheckInput): boolean {
  if (input.honeypot && input.honeypot.trim().length > 0) return true;
  if (!input.formRenderedAt) return true;
  return Date.now() - input.formRenderedAt < MIN_SUBMIT_DELAY_MS;
}
