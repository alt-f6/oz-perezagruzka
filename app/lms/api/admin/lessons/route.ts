import { NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRoleApi } from "@/lms/server/auth/require-role-api";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { getDefaultModuleId } from "@/lms/server/repos/default-module";
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

export const GET = withApiErrors(async () => {
  const user = await requireRoleApi(["ADMIN", "MANAGER"]);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const lessons = await db.lesson.findMany({
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ ok: true, lessons: lessons.map(toLessonJson) });
});

export const POST = withApiErrors(async () => {
  const user = await requireRoleApi(["ADMIN", "MANAGER"]);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const lesson = await db.$transaction(async (tx) => {
    const moduleId = await getDefaultModuleId(user.id);
    const max = await tx.lesson.aggregate({ _max: { order: true } });

    return tx.lesson.create({
      data: {
        moduleId,
        title: "Новый урок",
        description: "",
        content: "",
        isPublished: false,
        order: (max._max.order ?? 0) + 1,
      },
    });
  });

  return NextResponse.json({ ok: true, lesson: toLessonJson(lesson) });
});
