import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRoleApi } from "@/lms/server/auth/require-role-api";
import { withApiErrors } from "@/lms/server/http/api-guard";
import type { LessonMedia } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function readLessonId(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id || typeof id !== "string") return null;
  return id;
}

function normalize(url: string) {
  const raw = url.trim();

  const yt =
    raw.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) ||
    raw.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (yt) {
    return { provider: "youtube", embed_url: `https://www.youtube.com/embed/${yt[1]}`, url: raw };
  }

  const vimeo = raw.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return { provider: "vimeo", embed_url: `https://player.vimeo.com/video/${vimeo[1]}`, url: raw };
  }

  throw new Error("UNSUPPORTED");
}

function toMediaJson(media: LessonMedia) {
  return {
    id: media.id,
    lesson_id: media.lessonId,
    kind: media.kind,
    title: media.title,
    url: media.url,
    provider: media.provider,
    embed_url: media.embedUrl,
    order: media.order,
    is_public: media.isPublic,
    created_at: media.createdAt,
  };
}

export const GET = withApiErrors(async (_: NextRequest, ctx: Ctx) => {
  const user = await requireRoleApi(["ADMIN", "MANAGER"]);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const lessonId = await readLessonId(ctx);
  if (!lessonId) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const media = await db.lessonMedia.findMany({
    where: { lessonId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ ok: true, media: media.map(toMediaJson) });
});

export const POST = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireRoleApi(["ADMIN", "MANAGER"]);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const lessonId = await readLessonId(ctx);
  if (!lessonId) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const urlRaw = typeof body.url === "string" ? body.url : "";
  const is_public = body.is_public === undefined ? true : Boolean(body.is_public);

  let norm;
  try {
    norm = normalize(urlRaw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_video_url" }, { status: 400 });
  }

  const max = await db.lessonMedia.aggregate({
    where: { lessonId },
    _max: { order: true },
  });
  const order = (max._max.order ?? 0) + 1;

  const media = await db.lessonMedia.create({
    data: {
      lessonId,
      kind: "video",
      title: title || null,
      url: norm.url,
      provider: norm.provider,
      embedUrl: norm.embed_url,
      order,
      isPublic: is_public,
    },
  });

  return NextResponse.json({ ok: true, media: toMediaJson(media) });
});
