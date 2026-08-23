import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { headObject } from "@/lms/server/r2/signed";
import { LESSON_ASSET_MAX_SIZE_BYTES, LESSON_ASSET_PDF_MIME, readLessonAssetScope } from "@/lms/lib/lesson-assets";
import { createLogger } from "@/shared/lib/logger";

export const runtime = "nodejs";

const logger = createLogger("lms.api.admin.assets.complete");

type Ctx = { params: Promise<{ id: string }> };

async function readAssetId({ params }: Ctx) {
  const { id } = await params;
  if (!id || typeof id !== "string") {
    return null;
  }

  return id;
}

export const POST = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRole(["ADMIN", "MANAGER"], { adminBypass: true });

  const assetId = await readAssetId(ctx);
  if (!assetId) {
    return NextResponse.json({ ok: false, error: "bad assetId" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const lessonId = readLessonAssetScope(body.lessonId);
  const sizeBytes = Number(body.sizeBytes || 0);
  const isPublic = body.isPublic === undefined ? true : Boolean(body.isPublic);

  if (!lessonId) {
    return NextResponse.json({ ok: false, error: "bad lessonId" }, { status: 400 });
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ ok: false, error: "bad file size" }, { status: 400 });
  }

  if (sizeBytes > LESSON_ASSET_MAX_SIZE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "file too large", maxSizeBytes: LESSON_ASSET_MAX_SIZE_BYTES },
      { status: 400 }
    );
  }

  const row = await db.lessonAsset.findUnique({ where: { id: assetId } });
  if (!row || row.lessonId !== lessonId) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (row.kind !== "pdf") return NextResponse.json({ ok: false, error: "unsupported_asset_kind" }, { status: 400 });

  const key = String(row.storageKey || "");
  if (!key) return NextResponse.json({ ok: false, error: "missing_storage_key" }, { status: 400 });

  try {
    const head = await headObject(key);
    const objectSize = Number(head.ContentLength || 0);
    const objectType = String(head.ContentType || "").toLowerCase();

    if (!Number.isFinite(objectSize) || objectSize <= 0) {
      return NextResponse.json({ ok: false, error: "empty_file_in_r2" }, { status: 400 });
    }

    if (objectSize > LESSON_ASSET_MAX_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "file too large", maxSizeBytes: LESSON_ASSET_MAX_SIZE_BYTES },
        { status: 400 }
      );
    }

    if (sizeBytes !== objectSize) {
      return NextResponse.json({ ok: false, error: "size mismatch" }, { status: 400 });
    }

    if (objectType && objectType !== LESSON_ASSET_PDF_MIME) {
      return NextResponse.json({ ok: false, error: "unexpected_content_type" }, { status: 400 });
    }
  } catch (error) {
    logger.error("admin asset complete head error", error, { assetId, lessonId, key });
    return NextResponse.json({ ok: false, error: "file not found in r2" }, { status: 400 });
  }

  await db.lessonAsset.update({
    where: { id: assetId },
    data: { sizeBytes, isPublic },
  });

  return NextResponse.json({ ok: true });
});
