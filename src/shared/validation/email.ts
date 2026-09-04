import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Укажите email" })
  .toLowerCase()
  .pipe(z.email({ message: "Введите корректный email" }));

/**
 * Optional, normalized email. An empty/blank input resolves to `undefined`
 * (the field was left blank), while any non-empty value is trimmed, lowered
 * and validated. Mirrors `russianPhoneOptionalSchema` so optional contact
 * fields behave consistently across forms.
 */
export const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const parsed = z.email({ message: "Введите корректный email" }).safeParse(value);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", message: "Введите корректный email" });
      return z.NEVER;
    }
    return parsed.data;
  })
  .optional();
