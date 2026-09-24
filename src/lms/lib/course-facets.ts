import { isExamType, isGrade, isSubject, type ExamType, type Subject } from "@/shared/lib/education";

// Validates the optional catalog facets on a Course create/update body.
// Each field is tri-state: absent (leave unchanged), null/"" (clear), or a
// valid value. Invalid values produce an error code instead of being coerced.

export type CourseFacetPatch = {
  subject?: Subject | null;
  examType?: ExamType | null;
  grade?: number | null;
};

export type CourseFacetResult = { ok: true; data: CourseFacetPatch } | { ok: false; error: string };

function isBlank(value: unknown): boolean {
  return value === null || value === "";
}

export function parseCourseFacets(body: Record<string, unknown>): CourseFacetResult {
  const data: CourseFacetPatch = {};

  if ("subject" in body) {
    if (isBlank(body.subject)) data.subject = null;
    else if (isSubject(body.subject)) data.subject = body.subject;
    else return { ok: false, error: "invalid_subject" };
  }

  if ("exam_type" in body) {
    const exam = typeof body.exam_type === "string" ? body.exam_type.toUpperCase() : body.exam_type;
    if (isBlank(exam)) data.examType = null;
    else if (isExamType(exam)) data.examType = exam;
    else return { ok: false, error: "invalid_exam_type" };
  }

  if ("grade" in body) {
    const grade = typeof body.grade === "string" && body.grade !== "" ? Number(body.grade) : body.grade;
    if (isBlank(grade)) data.grade = null;
    else if (isGrade(grade)) data.grade = grade;
    else return { ok: false, error: "invalid_grade" };
  }

  return { ok: true, data };
}
