// Educational vocabulary shared by CRM (Group/Student) and LMS (Course).
// Both sides store these as plain strings; this is the single list the LMS
// admin offers, kept identical to the landing wizard's SUBJECT_VALUES
// (src/landing/lib/validations/readiness.ts) so a CRM group's subject matches
// an LMS course's subject verbatim.

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

export type Subject = (typeof SUBJECT_VALUES)[number];

export const EXAM_TYPE_VALUES = ["OGE", "EGE"] as const;

export type ExamType = (typeof EXAM_TYPE_VALUES)[number];

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  OGE: "ОГЭ",
  EGE: "ЕГЭ",
};

export const GRADE_VALUES = [8, 9, 10, 11] as const;

export function isSubject(value: unknown): value is Subject {
  return typeof value === "string" && (SUBJECT_VALUES as readonly string[]).includes(value);
}

export function isExamType(value: unknown): value is ExamType {
  return typeof value === "string" && (EXAM_TYPE_VALUES as readonly string[]).includes(value);
}

export function isGrade(value: unknown): value is (typeof GRADE_VALUES)[number] {
  return typeof value === "number" && (GRADE_VALUES as readonly number[]).includes(value);
}
