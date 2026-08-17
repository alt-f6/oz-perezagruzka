import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: "Укажите email" })
  .toLowerCase()
  .pipe(z.email({ message: "Введите корректный email" }));
