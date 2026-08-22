import { z } from "zod";

// Single source of truth for the wizard's selectable option *values*. The UI
// (`ReadinessMapWizard`) imports these instead of redeclaring its own string
// literals, so client options and server-side validation can never drift.
export const SUBJECT_VALUES = [
  "Математика",
  "Русский язык",
  "Информатика",
  "Обществознание",
  "Физика",
  "Химия",
  "Биология",
  "География",
  "Английский",
  "История",
  "Литература",
] as const;

export const STUDY_STYLE_VALUES = [
  "Учится самостоятельно, высокая успеваемость",
  "Учится сам, но нет четкой системы знаний",
  "Нужно регулярно напоминать и контролировать домашку",
  "Учеба запущена, боимся не сдать экзамены",
] as const;

export const HOBBY_VALUES = [
  "Компьютерные игры и IT",
  "Спорт и активный отдых",
  "Рисование, музыка, творчество",
  "Блогинг, соцсети, видеоролики",
  "Чтение и саморазвитие",
  "Общение и прогулки с друзьями",
] as const;

const subjectEnum = z.enum(SUBJECT_VALUES);
const hobbyEnum = z.enum(HOBBY_VALUES);

export const readinessInputSchema = z.object({
  name: z.string().trim().max(80).optional().or(z.literal("")),
  grade: z.enum(["7", "8", "9"]),
  // Serialized by the wizard as a `", "`-joined list of up to 2
  // SUBJECT_VALUES; keep the split delimiter in sync with
  // `ReadinessMapWizard`'s `next.join(", ")`. Subject values never contain
  // internal commas, so this delimiter is unambiguous to split on.
  subjects: z
    .string()
    .trim()
    .min(2, "Укажите хотя бы один предмет")
    .max(1000)
    .refine(
      (val) => {
        const parts = val.split(", ").filter(Boolean);
        return parts.length >= 1 && parts.length <= 2;
      },
      { message: "Можно выбрать не более 2 предметов" },
    )
    .refine(
      (val) => val.split(", ").filter(Boolean).every((part) => subjectEnum.safeParse(part).success),
      { message: "Недопустимый предмет" },
    ),
  studyStyle: z.enum(STUDY_STYLE_VALUES, "Выберите стиль учёбы"),
  // Serialized by the wizard as a `"|"`-joined list of up to 4 HOBBY_VALUES.
  // `"|"` is used (not `", "`) because several hobby values themselves
  // contain an internal `", "`, which would make a comma-based split
  // ambiguous. Kept in sync with `ReadinessMapWizard`'s hobby-toggle limit.
  hobbies: z
    .string()
    .trim()
    .min(2, "Выберите хотя бы одно увлечение")
    .max(1000)
    .refine(
      (val) => {
        const parts = val.split("|").filter(Boolean);
        return parts.length >= 1 && parts.length <= 4;
      },
      { message: "Можно выбрать не более 4 увлечений" },
    )
    .refine(
      (val) => val.split("|").filter(Boolean).every((part) => hobbyEnum.safeParse(part).success),
      { message: "Недопустимое увлечение" },
    ),
  deadline: z.enum(["<3m", "3-6m", "6-12m", ">1y"]),
});

export type ReadinessInput = z.infer<typeof readinessInputSchema>;

export const utmSchema = z.object({
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  clickId: z.string().optional(),
  referrer: z.string().optional(),
  landingPage: z.string().optional(),
});

export type Utm = z.infer<typeof utmSchema>;

export const readinessActionInputSchema = z.object({
  input: readinessInputSchema,
  sessionId: z.string(),
  utm: utmSchema,
  consent: z.literal(true, "Необходимо согласие на обработку персональных данных"),
  honeypot: z.string().max(200).optional(),
  formRenderedAt: z.number().optional(),
});

export const readinessOutputSchema = z.object({
  readinessScore: z.number().min(0).max(100),
  whatISee: z.string(),
  attentionZones: z.union([z.string(), z.array(z.string())]),
  strengths: z.union([z.string(), z.array(z.string())]),
  futurePaths: z.union([z.string(), z.array(z.string())]),
  firstStep: z.string(),
});

export type ReadinessOutput = z.infer<typeof readinessOutputSchema>;