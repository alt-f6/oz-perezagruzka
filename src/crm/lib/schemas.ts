import { z } from "zod";
import { russianPhoneSchema, russianPhoneOptionalSchema } from "@/shared/validation/phone";

// ─────────────────────────────────────────────────────────────
// Educational domain enums (shared by Student and Group)
// ─────────────────────────────────────────────────────────────

// "Класс" — school year. Persisted as Int? on Student/Group.
export const gradeValues = [8, 9, 10, 11] as const;
// "Экзамен" — ОГЭ (grade 9) / ЕГЭ (grade 11). Persisted as String? using these
// stable codes; UI maps them to their Russian labels.
export const examTypeValues = ["OGE", "EGE"] as const;
export const examTypeSchema = z.enum(examTypeValues);

const emptyToUndefined = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

// Optional grade accepting "" (unset) from FormData; coerces to a bounded int.
export const optionalGradeSchema = z.preprocess(
  (v) => (emptyToUndefined(v) === undefined ? undefined : Number(v)),
  z
    .number()
    .int()
    .refine((n) => (gradeValues as readonly number[]).includes(n), {
      message: "Класс должен быть 8, 9, 10 или 11",
    })
    .optional(),
);

// Optional exam type accepting "" (unset) from FormData.
export const optionalExamTypeSchema = z.preprocess(
  emptyToUndefined,
  examTypeSchema.optional(),
);

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
// Educational domain fields shared by the group create/update forms.
const groupDomainFields = {
  subject: z.string().trim().optional().or(z.literal("")),
  grade: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z
      .number()
      .int()
      .refine((n) => (gradeValues as readonly number[]).includes(n), {
        message: "Класс должен быть 8, 9, 10 или 11",
      })
      .optional(),
  ),
  examType: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    examTypeSchema.optional(),
  ),
};

export const createGroupSchema = groupSchema.extend({
  teacherId: z.uuid({ message: "Выберите преподавателя" }).optional(),
  price: z.coerce
    .number()
    .min(0, { message: "Цена не может быть отрицательной" })
    .max(1_000_000, { message: "Слишком большая цена" })
    .optional(),
  ...groupDomainFields,
});

// Full server-side input for updateGroup: unlike createGroupSchema, teacherId
// is nullable (not just optional) so the edit modal can explicitly unassign
// the teacher, and price is required since the edit form always shows it.
export const updateGroupSchema = groupSchema.extend({
  teacherId: z.uuid({ message: "Некорректный преподаватель" }).nullable(),
  price: z.coerce
    .number()
    .min(0, { message: "Цена не может быть отрицательной" })
    .max(1_000_000, { message: "Слишком большая цена" }),
  ...groupDomainFields,
});

export const balanceAdjustmentSchema = z.object({
  amount: z.coerce
    .number()
    .refine((v) => v !== 0, { message: "Сумма не может быть нулевой" })
    .refine((v) => Number.isFinite(v), { message: "Некорректная сумма" })
    .refine((v) => Math.abs(v) <= 1_000_000, { message: "Слишком большая сумма" }),
  description: z.string().optional().or(z.literal("")),
});

const optionalText = z.string().trim().optional().or(z.literal(""));

// Fields shared by the student create/update forms and the student card.
const studentDomainFields = {
  parentName: optionalText,
  parentPhone: russianPhoneOptionalSchema,
  comment: optionalText,
  grade: optionalGradeSchema,
  examType: optionalExamTypeSchema,
  subject: optionalText,
};

export const studentSchema = z.object({
  name: z.string().min(2, { message: "Введите имя студента" }),
  phone: russianPhoneOptionalSchema,
  groupId: z.uuid().or(z.literal("")),
  ...studentDomainFields,
});

// Update payload for the student card. No groupId (group membership is managed
// separately via assign/removeStudentFromGroup); all domain fields optional so
// a partial save is valid.
export const studentUpdateSchema = z.object({
  name: z.string().min(2, { message: "Введите имя студента" }),
  phone: russianPhoneOptionalSchema,
  ...studentDomainFields,
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

// Per-weekday time slot override. When a recurring series should run at a
// different start time / duration on individual days (e.g. Mon 15:00·60min but
// Sat 10:00·90min), each selected day carries its own slot here. Days without
// an override fall back to the top-level `time` / `durationMinutes`.
export const daySlotSchema = z.object({
  // JS Date#getDay() convention: 0 = Sunday .. 6 = Saturday.
  day: z.number().int().min(0).max(6),
  time: z.string().min(1, { message: "Укажите время" }),
  durationMinutes: lessonDurationSchema,
});

// The set of weekdays a given recurrence pattern lands on. WEEKLY resolves at
// runtime from the start date, so it has no fixed per-day config here.
function recurrenceTargetDays(
  recurrence: z.infer<typeof recurrencePatternSchema>,
  recurrenceDays: number[] | undefined,
): number[] {
  if (recurrence === "WEEKDAYS") return [1, 2, 3, 4, 5];
  if (recurrence === "CUSTOM") return recurrenceDays ?? [];
  return [];
}

// Lesson format: a GROUP session is scheduled against an existing Group roster;
// an INDIVIDUAL (1-on-1) session is scheduled directly for a single student and
// teacher, with no dummy group required.
export const lessonTypeSchema = z.enum(["GROUP", "INDIVIDUAL"]);

export const lessonSchema = z
  .object({
    // Optional (not `.default`) so the zod input and output types stay aligned
    // for react-hook-form; an absent type means GROUP, preserving the behavior
    // of every existing caller and FormData that omits it.
    type: lessonTypeSchema.optional(),
    // Required for GROUP sessions (validated below); ignored for INDIVIDUAL.
    groupId: z.uuid().optional().or(z.literal("")),
    // Required for INDIVIDUAL sessions (validated below); ignored for GROUP.
    studentId: z.uuid().optional().or(z.literal("")),
    teacherId: z.uuid().optional().or(z.literal("")),
    // Optional per-lesson charge for INDIVIDUAL sessions. Kept as a string (the
    // raw HTML number-input value) so the zod input and output types stay equal
    // for react-hook-form; the action coerces it to a number. "" means "unset".
    pricePerLesson: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => {
          if (!v) return true;
          const n = Number(v);
          return Number.isFinite(n) && n >= 0 && n <= 1_000_000;
        },
        { message: "Некорректная цена (0–1 000 000)" },
      ),
    date: z.string().min(1, { message: "Укажите дату" }),
    time: z.string().min(1, { message: "Укажите время" }),
    durationMinutes: lessonDurationSchema,
    recurrence: recurrencePatternSchema,
    // JS Date#getDay() convention: 0 = Sunday .. 6 = Saturday.
    recurrenceDays: z.array(z.number().int().min(0).max(6)).optional(),
    recurrenceEndDate: z.string().optional().or(z.literal("")),
    // Optional per-weekday time/duration overrides for multi-day series.
    daySlots: z.array(daySlotSchema).optional(),
  })
  // An absent `type` is treated as GROUP, so GROUP validation fires unless the
  // caller explicitly chose INDIVIDUAL.
  .refine((data) => data.type === "INDIVIDUAL" || !!data.groupId, {
    message: "Выберите группу",
    path: ["groupId"],
  })
  .refine((data) => data.type !== "INDIVIDUAL" || !!data.studentId, {
    message: "Выберите ученика",
    path: ["studentId"],
  })
  .refine((data) => data.type !== "INDIVIDUAL" || !!data.teacherId, {
    message: "Выберите преподавателя",
    path: ["teacherId"],
  })
  .refine(
    (data) => data.recurrence !== "CUSTOM" || (data.recurrenceDays && data.recurrenceDays.length > 0),
    { message: "Выберите хотя бы один день недели", path: ["recurrenceDays"] },
  )
  .refine((data) => data.recurrence === "NONE" || !!data.recurrenceEndDate, {
    message: "Укажите дату окончания повтора",
    path: ["recurrenceEndDate"],
  })
  .refine(
    // Every weekday the series lands on must resolve to a concrete start time:
    // either its own daySlot override or the top-level default `time`.
    (data) =>
      recurrenceTargetDays(data.recurrence, data.recurrenceDays).every(
        (day) => data.daySlots?.some((s) => s.day === day && s.time) || !!data.time,
      ),
    { message: "Укажите время для каждого выбранного дня", path: ["daySlots"] },
  );

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
export type UpdateGroupValues = z.infer<typeof updateGroupSchema>;
export type StudentValues = z.infer<typeof studentSchema>;
export type StudentUpdateValues = z.infer<typeof studentUpdateSchema>;
export type ExamType = z.infer<typeof examTypeSchema>;
export type LessonType = z.infer<typeof lessonTypeSchema>;
export type LessonValues = z.infer<typeof lessonSchema>;
export type DaySlot = z.infer<typeof daySlotSchema>;
export type MakeupValues = z.infer<typeof makeupSchema>;
export type ExamGoalValues = z.infer<typeof examGoalSchema>;
export type ExamResultValues = z.infer<typeof examResultSchema>;
export type LeadStatusValue = z.infer<typeof leadStatusEnum>;
export type LeadValues = z.infer<typeof leadSchema>;
export type PaymentAmountValues = z.infer<typeof paymentAmountSchema>;
export type BalanceAdjustmentValues = z.infer<typeof balanceAdjustmentSchema>;