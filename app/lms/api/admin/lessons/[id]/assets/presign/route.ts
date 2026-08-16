import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRoleApi } from "@/lms/server/auth/require-role-api";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { signPutObject } from "@/lms/server/r2/signed";
import { LESSON_ASSET_MAX_SIZE_BYTES, LESSON_ASSET_PDF_MIME } from "@/lms/lib/lesson-assets";

export const runtime = "nodejs";

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

function titleFromFilename(name: string) {
  return name.replace(/\.pdf$/i, "").trim() || name;
}

type Ctx = { params: Promise<{ id: string }> };

async function readLessonId({ params }: Ctx) {
  const { id } = await params;
  if (!id || typeof id !== "string") {
    return null;
  }

  return id;
}

export const POST = withApiErrors(async (req: NextRequest, ctx: Ctx) => {
  await requireRoleApi(["ADMIN", "MANAGER"]);

  const lessonId = await readLessonId(ctx);
  if (!lessonId) {
    return NextResponse.json({ ok: false, error: "bad lessonId" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const originalName = safeName(String(body.filename || "file.pdf"));
  const title = String(body.title || "").trim() || titleFromFilename(originalName);
  const mimeType = String(body.mimeType || LESSON_ASSET_PDF_MIME).trim().toLowerCase();
  const sizeBytes = Number(body.sizeBytes || 0);

  if (!originalName) {
    return NextResponse.json({ ok: false, error: "bad filename" }, { status: 400 });
  }

  if (mimeType !== LESSON_ASSET_PDF_MIME || !originalName.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ ok: false, error: "only pdf allowed" }, { status: 400 });
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

  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) {
    return NextResponse.json({ ok: false, error: "lesson_not_found" }, { status: 404 });
  }

  let assetId: string | null = null;
  let storageKey = "";

  try {
    const asset = await db.$transaction(async (tx) => {
      const max = await tx.lessonAsset.aggregate({
        where: { lessonId },
        _max: { order: true },
      });
      const nextOrder = (max._max.order ?? 0) + 1;

      const created = await tx.lessonAsset.create({
        data: {
          lessonId,
          kind: "pdf",
          title,
          originalName,
          mimeType,
          sizeBytes: 0,
          storageKey: "",
          order: nextOrder,
          isPublic: false,
        },
      });

      const key = `lessons/${lessonId}/assets/${created.id}-${originalName}`;

      return tx.lessonAsset.update({
        where: { id: created.id },
        data: { storageKey: key },
      });
    });

    assetId = asset.id;
    storageKey = asset.storageKey;
  } catch (error) {
    console.error("admin asset presign db error", { lessonId, originalName, error });
    throw error;
  }

  try {
    const uploadUrl = await signPutObject(storageKey, mimeType);
    return NextResponse.json({ ok: true, assetId, storageKey, uploadUrl, maxSizeBytes: LESSON_ASSET_MAX_SIZE_BYTES });
  } catch (error) {
    console.error("admin asset presign signing error", { lessonId, assetId, storageKey, error });
    if (assetId !== null) {
      await db.lessonAsset.delete({ where: { id: assetId } });
    }
    return NextResponse.json({ ok: false, error: "upload_url_generation_failed" }, { status: 502 });
  }
});
