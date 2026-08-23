import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { deleteObject } from "@/lms/server/r2/signed";
import { readLessonAssetScope } from "@/lms/lib/lesson-assets";
import type { LessonAsset } from "@prisma/client";
import { createLogger } from "@/shared/lib/logger";

export const runtime = "nodejs";

const logger = createLogger("lms.api.admin.assets");

type Ctx = { params: Promise<{ id: string }> };

// order value used as a temporary sentinel while swapping two rows that share
// a @@unique([lessonId, order]) constraint, so the swap never collides mid-transaction
const SENTINEL_ORDER = -1;

async function readAssetId({ params }: Ctx) {
  const { id } = await params;
  if (!id || typeof id !== "string") return null;
  return id;
}

function toAssetJson(asset: LessonAsset) {
  return {
    id: asset.id,
    lesson_id: asset.lessonId,
    kind: asset.kind,
    title: asset.title,
    original_name: asset.originalName,
    mime_type: asset.mimeType,
    size_bytes: Number(asset.sizeBytes),
    storage_key: asset.storageKey,
    order: asset.order,
    is_public: asset.isPublic,
    created_at: asset.createdAt,
  };
}

export const PATCH = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  const id = await readAssetId(ctx);
  if (!id) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const lessonId = readLessonAssetScope(body.lessonId);
  if (!lessonId) return NextResponse.json({ ok: false, error: "bad lessonId" }, { status: 400 });

  const row = await db.lessonAsset.findUnique({ where: { id } });
  if (!row || row.lessonId !== lessonId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (row.kind !== "pdf") {
    return NextResponse.json({ ok: false, error: "unsupported_asset_kind" }, { status: 400 });
  }

  const title =
    body.title === undefined
      ? row.title
      : typeof body.title === "string"
      ? body.title.trim() || null
      : null;

  const is_public = body.is_public === undefined ? row.isPublic : Boolean(body.is_public);

  let order = body.order === undefined ? row.order : Number(body.order);
  if (!Number.isFinite(order) || order <= 0) order = row.order;

  try {
    const updated = await db.$transaction(async (tx) => {
      if (order !== row.order) {
        const other = await tx.lessonAsset.findFirst({
          where: { lessonId, order },
        });

        if (other) {
          await tx.lessonAsset.update({ where: { id }, data: { order: SENTINEL_ORDER } });
          await tx.lessonAsset.update({ where: { id: other.id }, data: { order: row.order } });
          await tx.lessonAsset.update({ where: { id }, data: { order } });
        } else {
          await tx.lessonAsset.update({ where: { id }, data: { order } });
        }
      }

      return tx.lessonAsset.update({
        where: { id },
        data: { title, isPublic: is_public },
      });
    });

    return NextResponse.json({ ok: true, asset: toAssetJson(updated) });
  } catch (error) {
    logger.error("admin asset patch error", error, { assetId: id, lessonId });
    return NextResponse.json({ ok: false, error: "asset_update_failed" }, { status: 500 });
  }
});

export const DELETE = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  const id = await readAssetId(ctx);
  if (!id) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });

  const lessonId = readLessonAssetScope(req.nextUrl.searchParams.get("lessonId"));
  if (!lessonId) return NextResponse.json({ ok: false, error: "bad lessonId" }, { status: 400 });

  const row = await db.lessonAsset.findUnique({ where: { id }, select: { lessonId: true, kind: true, storageKey: true } });
  if (!row || row.lessonId !== lessonId) return NextResponse.json({ ok: true, deleted: false });
  if (row.kind !== "pdf") {
    return NextResponse.json({ ok: false, error: "unsupported_asset_kind" }, { status: 400 });
  }

  await db.lessonAsset.delete({ where: { id } });

  const storageKey = String(row.storageKey || "");
  if (storageKey) {
    try {
      await deleteObject(storageKey);
    } catch (error) {
      logger.error("admin asset storage cleanup failed (db row already deleted)", error, {
        assetId: id,
        lessonId,
        storageKey,
      });
    }
  }

  return NextResponse.json({ ok: true, deleted: true });
});
