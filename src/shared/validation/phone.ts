import { z } from "zod";

const PHONE_ERROR_MESSAGE =
  "Введите корректный номер телефона в формате +7XXXXXXXXXX";

/**
 * Normalizes a Russian phone number to canonical `+7XXXXXXXXXX` form.
 * Accepts `+7...`, `8...`, `7...` with optional spaces, dashes and parens.
 * Returns null if the input is not a valid Russian mobile/landline number.
 */
export function normalizeRussianPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;

  let national: string;
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    national = digits.slice(1);
  } else if (digits.length === 10 && digits.startsWith("9")) {
    national = digits;
  } else {
    return null;
  }

  return `+7${national}`;
}

export const russianPhoneSchema = z
  .string()
  .trim()
  .min(1, { message: "Укажите номер телефона" })
  .transform((value, ctx) => {
    const normalized = normalizeRussianPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: PHONE_ERROR_MESSAGE });
      return z.NEVER;
    }
    return normalized;
  });

/**
 * Formats raw keystroke input into a Russian phone mask (`+7 (999) 123-45-67`)
 * as the user types. Single source of truth for the masking behavior shared
 * by every phone input in the landing funnel.
 */
export function formatRussianPhoneInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "");
  if (digits.length === 0) return "";

  let formatted = "+7";
  const startIdx = digits[0] === "7" || digits[0] === "8" ? 1 : 0;
  const remaining = digits.substring(startIdx);

  if (remaining.length > 0) {
    formatted += " (" + remaining.substring(0, 3);
  }
  if (remaining.length >= 4) {
    formatted += ") " + remaining.substring(3, 6);
  }
  if (remaining.length >= 7) {
    formatted += "-" + remaining.substring(6, 8);
  }
  if (remaining.length >= 9) {
    formatted += "-" + remaining.substring(8, 10);
  }
  return formatted;
}

export const russianPhoneOptionalSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const normalized = normalizeRussianPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: PHONE_ERROR_MESSAGE });
      return z.NEVER;
    }
    return normalized;
  })
  .optional();
