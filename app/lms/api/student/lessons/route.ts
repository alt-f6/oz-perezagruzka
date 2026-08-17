import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lms/server/auth/require-role-api";
import { db } from "@/shared/lib/db";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const GET = withApiErrors(async () => {
  const user = await requireRoleApi("STUDENT");

  const assignments = await db.assignment.findMany({
    where: { studentId: user.id, lesson: { isPublished: true } },
    include: { lesson: { include: { progress: { where: { studentId: user.id } } } } },
    orderBy: [{ lesson: { order: "asc" } }, { lesson: { id: "asc" } }],
    take: 500,
  });

  const lessons = assignments.map((a) => ({
    id: a.lesson.id,
    title: a.lesson.title,
    description: a.lesson.description,
    order: a.lesson.order,
    completed_at: a.lesson.progress[0]?.completedAt ? a.lesson.progress[0].completedAt.toISOString() : null,
  }));

  return NextResponse.json({ ok: true, lessons });
});
