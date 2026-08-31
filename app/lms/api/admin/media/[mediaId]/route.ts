import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { createLogger } from "@/shared/lib/logger";
import { parseAndNormalizeVideoUrl } from "@/lms/lib/video-url";
import type { LessonMedia } from "@prisma/client";

export const runtime = "nodejs";

const log = createLogger("lms-admin-media");

const BAD_VIDEO_URL_MESSAGE =
  "Некорректная ссылка на видео. Поддерживаются VK Видео, RuTube, Kinescope, YouTube, Vimeo и прямые MP4 файлы";

type Ctx = { params: Promise<{ mediaId: string }> };

// order value used as a temporary sentinel while swapping two rows that share
// a @@unique([lessonId, order]) constraint, so the swap never collides mid-transaction
const SENTINEL_ORDER = -1;

async function readMediaId({ params }: Ctx) {
  const { mediaId } = await params;
  if (!mediaId || typeof mediaId !== "string") return null;
  return mediaId;
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

export const PATCH = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  const id = await readMediaId(ctx);
  if (!id) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const body = await req.json();

  const row = await db.lessonMedia.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const title =
    body.title === undefined
      ? row.title
      : typeof body.title === "string"
      ? body.title.trim()
      : null;

  const is_public = body.is_public === undefined ? row.isPublic : Boolean(body.is_public);

  let order = body.order === undefined ? row.order : Number(body.order);

  const urlRaw =
    body.url === undefined ? String(row.url ?? "") : typeof body.url === "string" ? body.url : "";

  let norm = {
    url: String(row.url ?? ""),
    provider: String(row.provider ?? ""),
    embed_url: String(row.embedUrl ?? ""),
  };

  if (typeof urlRaw === "string" && urlRaw.trim()) {
    const parsed = parseAndNormalizeVideoUrl(urlRaw);
    if (!parsed.isValid) {
      return NextResponse.json(
        { ok: false, error: "bad_url", message: BAD_VIDEO_URL_MESSAGE },
        { status: 400 }
      );
    }
    norm = { url: parsed.originalUrl, provider: parsed.provider, embed_url: parsed.embedUrl };
  }

  if (!Number.isFinite(order) || order <= 0) order = row.order;

  try {
    const updated = await db.$transaction(async (tx) => {
      if (order !== row.order) {
        const other = await tx.lessonMedia.findFirst({
          where: { lessonId: row.lessonId, order },
        });

        if (other) {
          await tx.lessonMedia.update({ where: { id }, data: { order: SENTINEL_ORDER } });
          await tx.lessonMedia.update({ where: { id: other.id }, data: { order: row.order } });
          await tx.lessonMedia.update({ where: { id }, data: { order } });
        } else {
          await tx.lessonMedia.update({ where: { id }, data: { order } });
        }
      }

      return tx.lessonMedia.update({
        where: { id },
        data: {
          title,
          url: norm.url,
          provider: norm.provider,
          embedUrl: norm.embed_url,
          isPublic: is_public,
        },
      });
    });

    return NextResponse.json({ ok: true, media: toMediaJson(updated) });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
});

export const DELETE = withApiErrors(async (_: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  const id = await readMediaId(ctx);
  if (!id) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  try {
    await db.lessonMedia.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    log.error("Не удалось удалить медиа", err);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
