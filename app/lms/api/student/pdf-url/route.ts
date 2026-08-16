import { NextResponse } from "next/server";
import { requireAuth } from "@/lms/server/auth/require-auth";
import { db } from "@/shared/lib/db";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { withApiErrors } from "@/lms/server/http/api-guard";
import { canViewLesson } from "@/lms/server/access/can-view-lesson";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const r2 = new S3Client({
  region: process.env.R2_REGION || "auto",
  endpoint: must("R2_ENDPOINT"),
  credentials: {
    accessKeyId: must("R2_ACCESS_KEY_ID"),
    secretAccessKey: must("R2_SECRET_ACCESS_KEY"),
  },
  forcePathStyle: true,
});

const BUCKET = must("R2_BUCKET");

export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  const user = await requireAuth();

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

  const ttl = Number(process.env.R2_SIGNED_URL_TTL_SECONDS || "180");

  const cmd = new GetObjectCommand({
    Bucket: BUCKET,
    Key: asset.storageKey,
    ResponseContentType: asset.mimeType || "application/pdf",
    ResponseContentDisposition: "inline",
  });

  const url = await getSignedUrl(r2, cmd, { expiresIn: ttl });

  return NextResponse.json({ ok: true, url, expiresIn: ttl });
});
