import { z } from "zod";
import { russianPhoneSchema, russianPhoneOptionalSchema } from "@/shared/validation/phone";

export const loginSchema = z.object({
  email: z.string().email({ message: "Введите корректный email" }),
  password: z
    .string()
    .min(6, { message: "Пароль должен быть не короче 6 символов" }),
});

export const registerSchema = z.object({
  name: z.string().min(2, { message: "Введите имя и фамилию" }),
  email: z.string().email({ message: "Введите корректный email" }),
  password: z
    .string()
    .min(6, { message: "Пароль должен быть не короче 6 символов" }),
});

export const groupSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Название группы должно быть не короче 2 символов" }),
});

// Full server-side input for createGroup, including the fields GroupsClient
// reads from raw FormData outside react-hook-form's registered fields.
// Kept separate from `groupSchema` so the client form's `useForm<GroupValues>`
// typing (which only registers `name`) isn't affected.
export const createGroupSchema = groupSchema.extend({
  teacherId: z.uuid({ message: "Выберите преподавателя" }).optional(),
  price: z.coerce
    .number()
    .min(0, { message: "Цена не может быть отрицательной" })
    .max(1_000_000, { message: "Слишком большая цена" })
    .optional(),
});

export const balanceAdjustmentSchema = z.object({
  amount: z.coerce
    .number()
    .refine((v) => v !== 0, { message: "Сумма не может быть нулевой" })
    .refine((v) => Number.isFinite(v), { message: "Некорректная сумма" })
    .refine((v) => Math.abs(v) <= 1_000_000, { message: "Слишком большая сумма" }),
  description: z.string().optional().or(z.literal("")),
});

export const studentSchema = z.object({
  name: z.string().min(2, { message: "Введите имя студента" }),
  phone: russianPhoneOptionalSchema,
  groupId: z.uuid().or(z.literal("")),
});

export const recurrencePatternSchema = z.enum(["NONE", "WEEKDAYS", "WEEKLY", "CUSTOM"]);

export const lessonDurationOptions = [30, 45, 60, 90, 120] as const;
export const lessonDurationSchema = z.union([
  z.literal(30),
  z.literal(45),
  z.literal(60),
  z.literal(90),
  z.literal(120),
]);

export const lessonSchema = z
  .object({
    groupId: z.uuid({ message: "Выберите группу" }),
    date: z.string().min(1, { message: "Укажите дату" }),
    time: z.string().min(1, { message: "Укажите время" }),
    durationMinutes: lessonDurationSchema.default(60),
    recurrence: recurrencePatternSchema,
    // JS Date#getDay() convention: 0 = Sunday .. 6 = Saturday.
    recurrenceDays: z.array(z.number().int().min(0).max(6)).optional(),
    recurrenceEndDate: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => data.recurrence !== "CUSTOM" || (data.recurrenceDays && data.recurrenceDays.length > 0),
    { message: "Выберите хотя бы один день недели", path: ["recurrenceDays"] },
  )
  .refine((data) => data.recurrence === "NONE" || !!data.recurrenceEndDate, {
    message: "Укажите дату окончания повтора",
    path: ["recurrenceEndDate"],
  });

export const makeupSchema = z.object({
  attendanceId: z.uuid({ message: "Некорректная запись посещаемости" }),
  targetLessonId: z.uuid({ message: "Выберите занятие для отработки" }),
});

export const examGoalSchema = z
  .object({
    subject: z.string().min(2, { message: "Укажите предмет" }),
    startScore: z.coerce
      .number()
      .int()
      .min(0, { message: "Стартовый балл не может быть отрицательным" }),
    targetScore: z.coerce.number().int().min(0, { message: "Укажите целевой балл" }),
  })
  .refine((data) => data.targetScore > data.startScore, {
    message: "Целевой балл должен быть больше стартового",
    path: ["targetScore"],
  });

export const examResultSchema = z
  .object({
    subject: z.string().min(2, { message: "Укажите предмет" }),
    testName: z.string().min(2, { message: "Укажите название работы" }),
    currentScore: z.coerce.number().int().min(0, { message: "Укажите набранный балл" }),
    maxScore: z.coerce.number().int().min(1).default(100),
    testedAt: z.string().min(1, { message: "Укажите дату проведения" }),
  })
  .refine((data) => data.currentScore <= data.maxScore, {
    message: "Балл не может превышать максимум",
    path: ["currentScore"],
  });

export const paymentAmountSchema = z.object({
  amount: z.coerce
    .number()
    .positive({ message: "Сумма должна быть больше нуля" })
    .max(1_000_000, { message: "Слишком большая сумма" }),
});

export const leadStatusEnum = z.enum([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "DIAGNOSTIC_SCHEDULED",
  "DIAGNOSTIC_CONDUCTED",
  "CONVERTED",
  "LOST",
  "CLOSED_LOST",
]);

export const leadSchema = z
  .object({
    studentName: z
      .string()
      .min(2, { message: "Имя ученика должно быть не менее 2 символов" }),
    parentName: z.string().optional().or(z.literal("")),
    phone: russianPhoneSchema,
    subject: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
    status: leadStatusEnum,
    closedLostReason: z.string().optional().or(z.literal("")),
    utmSource: z.string().optional().or(z.literal("")),
    utmMedium: z.string().optional().or(z.literal("")),
    utmCampaign: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      data.status !== "CLOSED_LOST" ||
      (data.closedLostReason && data.closedLostReason.trim().length > 0),
    {
      message: "Укажите причину отказа",
      path: ["closedLostReason"],
    },
  );

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type GroupValues = z.infer<typeof groupSchema>;
export type StudentValues = z.infer<typeof studentSchema>;
export type LessonValues = z.infer<typeof lessonSchema>;
export type MakeupValues = z.infer<typeof makeupSchema>;
export type ExamGoalValues = z.infer<typeof examGoalSchema>;
export type ExamResultValues = z.infer<typeof examResultSchema>;
export type LeadStatusValue = z.infer<typeof leadStatusEnum>;
export type LeadValues = z.infer<typeof leadSchema>;
export type PaymentAmountValues = z.infer<typeof paymentAmountSchema>;
export type BalanceAdjustmentValues = z.infer<typeof balanceAdjustmentSchema>;