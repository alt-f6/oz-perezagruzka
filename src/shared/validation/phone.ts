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
