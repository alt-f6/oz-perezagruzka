import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRoleApi } from "@/lms/server/auth/require-role-api";
import { withApiErrors } from "@/lms/server/http/api-guard";
import type { Lesson } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function readLessonId({ params }: Ctx) {
  const { id } = await params;
  if (!id || typeof id !== "string") return null;
  return id;
}

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

export const GET = withApiErrors(async (_: NextRequest, ctx: Ctx) => {
  const user = await requireRoleApi(["ADMIN", "MANAGER"]);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const lessonId = await readLessonId(ctx);
  if (!lessonId) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });

  if (!lesson) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lesson: toLessonJson(lesson) });
});

export const PATCH = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireRoleApi(["ADMIN", "MANAGER"]);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const lessonId = await readLessonId(ctx);
  if (!lessonId) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));

  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "");
  const content = String(body.content ?? "");
  const order = Number(body.order ?? 0);
  const is_published = Boolean(body.is_published);

  if (!title) return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });

  try {
    const lesson = await db.lesson.update({
      where: { id: lessonId },
      data: { title, description, content, order, isPublished: is_published },
    });

    return NextResponse.json({ ok: true, lesson: toLessonJson(lesson) });
  } catch {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
});
