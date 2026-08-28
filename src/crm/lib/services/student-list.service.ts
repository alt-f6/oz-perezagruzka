import { db } from "@/shared/lib/db";
import { buildCursorPage, parsePaginationParams } from "@/shared/lib/pagination";

export interface StudentListRow {
  id: string;
  fullName: string;
  phone: string | null;
  groups: { id: string; name: string; teacherId: string | null }[];
  transactions: { amount: number }[];
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
    orderBy: { id: "desc" },
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      fullName: true,
      groups: {
        select: { group: { select: { id: true, name: true, teacherId: true } } },
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
    return {
      id: s.id,
      fullName: s.fullName,
      phone: isTeacher ? null : (withFinancials.phone ?? null),
      groups: s.groups.map((g) => g.group).filter(Boolean),
      transactions: isTeacher
        ? []
        : (withFinancials.transactions ?? []).map((t) => ({ amount: Number(t.amount) })),
    };
  });

  return { students, nextCursor };
}
