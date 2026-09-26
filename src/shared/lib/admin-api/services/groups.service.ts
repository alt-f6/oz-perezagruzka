import { db } from "@/shared/lib/db";
import { toMoscowIso } from "../time";

// Active (non-deleted) CRM academic groups. Teacher and meeting URL are left
// out: neither is needed to reason about access, and both identify people.

export async function listGroups() {
  const groups = await db.group.findMany({
    where: { deletedAt: null },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      subject: true,
      examType: true,
      grade: true,
      capacity: true,
      createdAt: true,
      _count: { select: { students: { where: { student: { deletedAt: null } } }, enrollments: true } },
    },
  });

  return {
    items: groups.map((g) => ({
      id: g.id,
      name: g.name,
      subject: g.subject,
      examType: g.examType,
      grade: g.grade === null ? null : String(g.grade),
      capacity: g.capacity,
      memberCount: g._count.students,
      lmsEnrollmentCount: g._count.enrollments,
      createdAt: toMoscowIso(g.createdAt),
    })),
  };
}
