import { NextResponse } from "next/server";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { db } from "@/shared/lib/db";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { canViewLesson } from "@/lms/server/access/can-view-lesson";
import { signGetObject } from "@/lms/server/r2/signed";
import { enforceRateLimit } from "@/lms/server/http/rate-limit";
import { LESSON_ASSET_KIND_CONFIG } from "@/lms/lib/lesson-assets";

// Kinds this endpoint is willing to sign a GET url for. Kept as an explicit
// allowlist (rather than "anything in LESSON_ASSET_KINDS") because
// "presentation" assets are served as public static HTML, not signed R2
// objects, and shouldn't be routed through here.
const SIGNABLE_ASSET_KINDS = ["pdf", "audio"] as const;
type SignableAssetKind = (typeof SIGNABLE_ASSET_KINDS)[number];

function isSignableAssetKind(kind: string): kind is SignableAssetKind {
  return (SIGNABLE_ASSET_KINDS as readonly string[]).includes(kind);
}

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
  if (!isSignableAssetKind(asset.kind)) {
    return NextResponse.json({ ok: false, error: "unsupported_kind" }, { status: 400 });
  }
  if (!asset.isPublic) return NextResponse.json({ ok: false, error: "not_public" }, { status: 403 });
  if (!asset.storageKey) return NextResponse.json({ ok: false, error: "no_storage_key" }, { status: 400 });

  if (user.role === "STUDENT") {
    const allowed = await canViewLesson({ userId: user.id, role: user.role, lessonId: asset.lessonId });
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  const url = await signGetObject(asset.storageKey, {
    responseContentType: asset.mimeType || LESSON_ASSET_KIND_CONFIG[asset.kind].mime,
    responseContentDisposition: "inline",
  });

  return NextResponse.json({ ok: true, url });
});
