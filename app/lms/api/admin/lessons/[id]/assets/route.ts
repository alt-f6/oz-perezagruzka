import { NextRequest, NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { requireRoleApi } from "@/lms/server/auth/require-role-api";
import { withApiErrors } from "@/lms/server/http/api-guard";
import type { LessonAsset } from "@prisma/client";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function readLessonId({ params }: Ctx) {
  const { id } = await params;
  if (!id || typeof id !== "string") {
    return null;
  }

  return id;
}

function toAssetJson(asset: LessonAsset) {
  return {
    id: asset.id,
    kind: asset.kind,
    title: asset.title,
    original_name: asset.originalName,
    mime_type: asset.mimeType,
    size_bytes: Number(asset.sizeBytes),
    order: asset.order,
    is_public: asset.isPublic,
    created_at: asset.createdAt,
  };
}

export const GET = withApiErrors(async (_req: NextRequest, ctx: Ctx) => {
  await requireRoleApi(["ADMIN", "MANAGER"]);

  const lessonId = await readLessonId(ctx);
  if (!lessonId) {
    return NextResponse.json({ ok: false, error: "bad lessonId" }, { status: 400 });
  }

  const items = await db.lessonAsset.findMany({
    where: { lessonId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ ok: true, items: items.map(toAssetJson) });
});
