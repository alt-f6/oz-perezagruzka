import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { getDefaultModuleId } from "@/lms/server/repos/default-module";
import { nextLessonOrder } from "@/lms/server/repos/lesson-order";
import { buildCursorPage, parsePaginationParams } from "@/shared/lib/pagination";
import type { Lesson } from "@prisma/client";

export const runtime = "nodejs";

function toLessonJson(lesson: Lesson) {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    content: lesson.content,
    order: lesson.order,
    is_published: lesson.isPublished,
  };
}

export const GET = withApiErrors(async (req: NextRequest) => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  const { cursor, limit } = parsePaginationParams(new URL(req.url).searchParams);

  const rows = await db.lesson.findMany({
    orderBy: [{ order: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const { items, nextCursor } = buildCursorPage(rows, limit);

  return NextResponse.json({ ok: true, lessons: items.map(toLessonJson), nextCursor });
});

export const POST = withApiErrors(async (req: NextRequest) => {
  const user = await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  // Optional { module_id }: lets the lessons directory create a lesson straight
  // into a module. Without it the lesson lands in the default ("Без курса") module.
  const body = await req.json().catch(() => ({}));
  const requestedModuleId = body?.module_id ? String(body.module_id).trim() : null;

  if (requestedModuleId) {
    const exists = await db.module.findUnique({ where: { id: requestedModuleId }, select: { id: true } });
    if (!exists) return NextResponse.json({ ok: false, error: "module_not_found" }, { status: 400 });
  }

  const lesson = await db.$transaction(async (tx) => {
    const moduleId = requestedModuleId ?? (await getDefaultModuleId(user.id));

    return tx.lesson.create({
      data: {
        moduleId,
        title: "Новый урок",
        description: "",
        content: "",
        isPublished: false,
        order: await nextLessonOrder(moduleId, tx),
      },
    });
  });

  return NextResponse.json({ ok: true, lesson: toLessonJson(lesson) });
});
