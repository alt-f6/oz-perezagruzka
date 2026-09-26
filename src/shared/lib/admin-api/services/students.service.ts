import type { Prisma } from "@prisma/client";
import { db } from "@/shared/lib/db";
import { invalidParam } from "../errors";
import { formatSafeStudentName } from "../pii";

// 152-ФЗ: the query may be a phone or an e-mail (that is how operators know a
// student), but the answer never is. SafeStudent is the ONLY shape that leaves
// this module -- rows are built field by field, never spread.

export const MAX_STUDENT_RESULTS = 10;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

export interface SafeStudent {
  id: string;
  name: string;
  grade: string | null;
  group: string | null;
}

export function toSafeStudent(input: {
  id: string;
  fullName: string | null;
  grade: number | null | undefined;
  group: string | null | undefined;
}): SafeStudent {
  return {
    id: input.id,
    name: formatSafeStudentName(input.fullName),
    grade: input.grade === null || input.grade === undefined ? null : String(input.grade),
    group: input.group ?? null,
  };
}

function normalizeQuery(raw: unknown): string {
  const query = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
    throw invalidParam(
      "query",
      `Укажите запрос для поиска: от ${MIN_QUERY_LENGTH} до ${MAX_QUERY_LENGTH} символов (почта, телефон или фамилия)`,
    );
  }
  return query;
}

/** Text + phone predicates. A phone typed as "+7 (999) 123-45-67" also matches by its digits. */
function contactFilters(query: string): Array<{ field: "fullName" | "email" | "phone"; value: string }> {
  const filters: Array<{ field: "fullName" | "email" | "phone"; value: string }> = [
    { field: "fullName", value: query },
    { field: "email", value: query },
    { field: "phone", value: query },
  ];
  const digits = query.replace(/\D/g, "");
  if (digits.length >= 5 && digits !== query) {
    filters.push({ field: "phone", value: digits });
    // Russian numbers are stored as +7..., operators often type 8...
    if (digits.length === 11 && digits.startsWith("8")) filters.push({ field: "phone", value: `7${digits.slice(1)}` });
  }
  return filters;
}

const activeGroupName = {
  where: { group: { deletedAt: null } },
  orderBy: { group: { name: "asc" } },
  take: 1,
  select: { group: { select: { name: true } } },
} satisfies Prisma.Student$groupsArgs;

export async function findStudents(rawQuery: unknown): Promise<SafeStudent[]> {
  const query = normalizeQuery(rawQuery);
  const filters = contactFilters(query);

  const studentWhere: Prisma.StudentWhereInput = {
    deletedAt: null,
    OR: filters.map((f) => ({ [f.field]: { contains: f.value, mode: "insensitive" } })),
  };
  const userWhere: Prisma.UserWhereInput = {
    role: "STUDENT",
    OR: filters.map((f) => ({ [f.field]: { contains: f.value, mode: "insensitive" } })),
  };

  const [crmStudents, lmsUsers] = await Promise.all([
    db.student.findMany({
      where: studentWhere,
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      take: MAX_STUDENT_RESULTS,
      select: { id: true, userId: true, fullName: true, grade: true, groups: activeGroupName },
    }),
    db.user.findMany({
      where: userWhere,
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      take: MAX_STUDENT_RESULTS,
      select: {
        id: true,
        fullName: true,
        students: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { grade: true, groups: activeGroupName },
        },
      },
    }),
  ]);

  // One person = one row. The LMS account id is the canonical id (it is what
  // enrollments hang off); a CRM-only student falls back to the Student id.
  const byId = new Map<string, SafeStudent>();
  for (const u of lmsUsers) {
    const profile = u.students[0];
    byId.set(
      u.id,
      toSafeStudent({
        id: u.id,
        fullName: u.fullName,
        grade: profile?.grade,
        group: profile?.groups[0]?.group.name,
      }),
    );
  }
  for (const s of crmStudents) {
    const id = s.userId ?? s.id;
    const existing = byId.get(id);
    const candidate = toSafeStudent({ id, fullName: s.fullName, grade: s.grade, group: s.groups[0]?.group.name });
    byId.set(
      id,
      existing
        ? { ...existing, grade: existing.grade ?? candidate.grade, group: existing.group ?? candidate.group }
        : candidate,
    );
  }

  return [...byId.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .slice(0, MAX_STUDENT_RESULTS);
}
