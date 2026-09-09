import { db } from "@/shared/lib/db";
import { buildCursorPage } from "@/shared/lib/pagination";
import { computeMinGroupRemainingLessons } from "@/crm/lib/services/abonement.service";

export interface StudentListRow {
  id: string;
  fullName: string;
  phone: string | null;
  groups: { id: string; name: string; teacherId: string | null }[];
  transactions: { amount: number }[];
  // Lowest remaining-lessons figure across the student's groups against their
  // shared balance (see abonement.service.ts). Null for TEACHER callers (no
  // financial data loaded) or when it can't be computed (no groups, or every
  // group price is unset).
  minRemainingLessons: number | null;
}

export interface ListStudentsOpts {
  sessionUser: { id: string; role: string };
  search?: string;
  cursor?: string;
  limit?: number;
}

export async function listStudents(
  opts: ListStudentsOpts,
): Promise<{ students: StudentListRow[]; nextCursor: string | null }> {
  const { sessionUser } = opts;
  const isTeacher = sessionUser.role === "TEACHER";
  const search = opts.search?.trim();
  const limit = opts.limit ?? 50;

  const rows = await db.student.findMany({
    where: {
      deletedAt: null,
      ...(isTeacher ? { groups: { some: { group: { teacherId: sessionUser.id } } } } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      fullName: true,
      groups: {
        select: {
          group: { select: { id: true, name: true, teacherId: true, pricePerLesson: true } },
        },
      },
      ...(isTeacher ? {} : { phone: true, transactions: { select: { amount: true } } }),
    },
  });

  const { items, nextCursor } = buildCursorPage(rows, limit);

  const students: StudentListRow[] = items.map((s) => {
    const withFinancials = s as typeof s & {
      phone?: string | null;
      transactions?: { amount: unknown }[];
    };
    const groups = s.groups.map((g) => g.group).filter(Boolean);
    const transactions = isTeacher
      ? []
      : (withFinancials.transactions ?? []).map((t) => ({ amount: Number(t.amount) }));
    const balance = transactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      id: s.id,
      fullName: s.fullName,
      phone: isTeacher ? null : (withFinancials.phone ?? null),
      groups: groups.map((g) => ({ id: g.id, name: g.name, teacherId: g.teacherId })),
      transactions,
      // Balance is intentionally hidden from TEACHER elsewhere on this row
      // (no phone/transactions loaded); keep this figure hidden the same way
      // rather than exposing a possibly-misleading "0 remaining" derived from
      // an empty balance.
      minRemainingLessons: isTeacher
        ? null
        : computeMinGroupRemainingLessons(
            balance,
            groups.map((g) => ({ pricePerLesson: Number(g.pricePerLesson) })),
          ),
    };
  });

  return { students, nextCursor };
}
