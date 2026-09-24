import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { normalizePresentationUrl } from "@/lms/lib/presentation-url";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { nextLessonOrder } from "@/lms/server/repos/lesson-order";
import type { Lesson } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type LessonWithCourse = Lesson & { module: { courseId: string } };

async function readLessonId({ params }: Ctx) {
  const { id } = await params;
  if (!id || typeof id !== "string") return null;
  return id;
}

function toLessonJson(lesson: LessonWithCourse) {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    content: lesson.content,
    order: lesson.order,
    is_published: lesson.isPublished,
    practice_link_url: lesson.practiceLinkUrl,
    practice_link_label: lesson.practiceLinkLabel,
    presentation_embed_url: lesson.presentationEmbedUrl,
    homework_task: lesson.homeworkTask,
    module_id: lesson.moduleId,
    course_id: lesson.module.courseId,
  };
}

function normalizePracticeLink(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

export const GET = withApiErrors(async (_: NextRequest, ctx: Ctx) => {
  const user = await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const lessonId = await readLessonId(ctx);
  if (!lessonId) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lesson: toLessonJson(lesson) });
});

export const PATCH = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const lessonId = await readLessonId(ctx);
  if (!lessonId) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));

  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "");
  const content = String(body.content ?? "");
  const order = Number(body.order ?? 0);
  const is_published = Boolean(body.is_published);
  const practiceLinkUrl = normalizePracticeLink(body.practice_link_url);
  const practiceLinkLabel = normalizePracticeLink(body.practice_link_label);
  const presentationEmbedUrlRaw = normalizePracticeLink(body.presentation_embed_url);
  const presentationEmbedUrl = presentationEmbedUrlRaw ? normalizePresentationUrl(presentationEmbedUrlRaw) : null;
  const homeworkTask = String(body.homework_task ?? "").trim() || null;
  const moduleId = body.module_id ? String(body.module_id).trim() : null;

  if (!title) return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });

  if (practiceLinkUrl) {
    try {
      const parsed = new URL(practiceLinkUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad protocol");
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_practice_link_url" }, { status: 400 });
    }
  }

  if (presentationEmbedUrl) {
    try {
      const parsed = new URL(presentationEmbedUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad protocol");
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_presentation_embed_url" }, { status: 400 });
    }
  }

  // Moving to another module appends the lesson to the end of that module:
  // the order the editor sends is a position in the *old* module.
  const current = await db.lesson.findUnique({ where: { id: lessonId }, select: { moduleId: true } });
  if (!current) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const movingModule = moduleId !== null && moduleId !== current.moduleId;

  try {
    const lesson = await db.lesson.update({
      where: { id: lessonId },
      data: {
        title,
        description,
        content,
        order: movingModule ? await nextLessonOrder(moduleId) : order,
        isPublished: is_published,
        practiceLinkUrl,
        practiceLinkLabel: practiceLinkUrl ? practiceLinkLabel : null,
        presentationEmbedUrl,
        homeworkTask,
        ...(moduleId ? { moduleId } : {}),
      },
      include: { module: { select: { courseId: true } } },
    });

    return NextResponse.json({ ok: true, lesson: toLessonJson(lesson) });
  } catch {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
});
