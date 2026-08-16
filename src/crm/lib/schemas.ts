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

export const studentSchema = z.object({
  name: z.string().min(2, { message: "Введите имя студента" }),
  phone: russianPhoneOptionalSchema,
  groupId: z.uuid().or(z.literal("")),
});

export const lessonSchema = z.object({
  groupId: z.uuid({ message: "Выберите группу" }),
  date: z.string().min(1, { message: "Укажите дату и время" }),
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