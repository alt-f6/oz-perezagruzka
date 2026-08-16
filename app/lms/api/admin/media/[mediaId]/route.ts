import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRoleApi } from "@/lms/server/auth/require-role-api";
import { withApiErrors } from "@/lms/server/http/api-guard";
import type { LessonMedia } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ mediaId: string }> };

// order value used as a temporary sentinel while swapping two rows that share
// a @@unique([lessonId, order]) constraint, so the swap never collides mid-transaction
const SENTINEL_ORDER = -1;

async function readMediaId({ params }: Ctx) {
  const { mediaId } = await params;
  if (!mediaId || typeof mediaId !== "string") return null;
  return mediaId;
}

function normalize(url: string) {
  const raw = url.trim();

  const yt =
    raw.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/) ||
    raw.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);

  if (yt) {
    return {
      url: raw,
      provider: "youtube",
      embed_url: `https://www.youtube.com/embed/${yt[1]}`,
    };
  }

  const vimeo = raw.match(/vimeo\.com\/(\d+)/);
  if (vimeo) {
    return {
      url: raw,
      provider: "vimeo",
      embed_url: `https://player.vimeo.com/video/${vimeo[1]}`,
    };
  }

  throw new Error("unsupported");
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
  await requireRoleApi(["ADMIN", "MANAGER"]);

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

  try {
    if (typeof urlRaw === "string" && urlRaw.trim()) norm = normalize(urlRaw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_url" }, { status: 400 });
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
  await requireRoleApi(["ADMIN", "MANAGER"]);

  const id = await readMediaId(ctx);
  if (!id) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  await db.lessonMedia.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
});
