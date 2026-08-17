import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { signGetObject } from "@/lms/server/r2/signed";
import { buildInlineContentDisposition } from "@/lms/lib/lesson-assets";
import { canViewLesson } from "@/lms/server/access/can-view-lesson";
import { withApiErrors } from "@/lms/server/http/api-guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function readAssetId({ params }: Ctx) {
  const { id } = await params;
  if (!id) {
    return null;
  }

  return id;
}

export const GET = withApiErrors(async (_req: NextRequest, ctx: Ctx) => {
  const me = await requireAuth();

  const assetId = await readAssetId(ctx);
  if (!assetId) {
    return NextResponse.json({ ok: false, error: "bad assetId" }, { status: 400 });
  }

  const row = await db.lessonAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      lessonId: true,
      storageKey: true,
      isPublic: true,
      mimeType: true,
      originalName: true,
      sizeBytes: true,
    },
  });
  if (!row) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (!row.storageKey) {
    return NextResponse.json({ ok: false, error: "missing_storage_key" }, { status: 400 });
  }
  if (Number(row.sizeBytes || 0) <= 0) {
    return NextResponse.json({ ok: false, error: "asset_not_completed" }, { status: 409 });
  }

  if (me.role !== "ADMIN" && me.role !== "MANAGER") {
    if (!row.isPublic) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const allowed = await canViewLesson({ userId: me.id, role: me.role, lessonId: row.lessonId });
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  try {
    const url = await signGetObject(row.storageKey, {
      responseContentType: row.mimeType || "application/octet-stream",
      responseContentDisposition: buildInlineContentDisposition(row.originalName || `asset-${assetId}`),
    });
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    console.error("asset signed url error", { assetId, storageKey: row.storageKey, error });
    return NextResponse.json({ ok: false, error: "signed_url_generation_failed" }, { status: 502 });
  }
});
