import { NextResponse } from "next/server";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { db } from "@/shared/lib/db";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { canViewLesson } from "@/lms/server/access/can-view-lesson";
import { signGetObject } from "@/lms/server/r2/signed";
import { enforceRateLimit } from "@/lms/server/http/rate-limit";

export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  const user = await requireAuth();

  await enforceRateLimit(`lms:pdf-url:${user.id}`, 60, 60_000);

  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");

  if (!assetId) {
    return NextResponse.json({ ok: false, error: "assetId_invalid" }, { status: 400 });
  }

  const asset = await db.lessonAsset.findUnique({
    where: { id: assetId },
    select: { id: true, lessonId: true, kind: true, storageKey: true, mimeType: true, isPublic: true },
  });

  if (!asset) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (asset.kind !== "pdf") return NextResponse.json({ ok: false, error: "not_pdf" }, { status: 400 });
  if (!asset.isPublic) return NextResponse.json({ ok: false, error: "not_public" }, { status: 403 });
  if (!asset.storageKey) return NextResponse.json({ ok: false, error: "no_storage_key" }, { status: 400 });

  if (user.role === "STUDENT") {
    const allowed = await canViewLesson({ userId: user.id, role: user.role, lessonId: asset.lessonId });
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  const url = await signGetObject(asset.storageKey, {
    responseContentType: asset.mimeType || "application/pdf",
    responseContentDisposition: "inline",
  });

  return NextResponse.json({ ok: true, url });
});
