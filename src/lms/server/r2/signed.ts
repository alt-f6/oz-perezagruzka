import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lms/server/r2/client";

function readPositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Upload (PUT) URL lifetime. Must comfortably exceed the time it takes to
// upload the LARGEST allowed asset (LESSON_ASSET_MAX_SIZE_BYTES, 25 MB) on a
// slow connection — otherwise the presigned URL expires mid-upload, R2 returns
// 403, and the client tears the just-created asset back down (the "PDF shows
// progress then disappears" bug). 900s tolerates ~230 kbps sustained for a
// 25 MB file, covering realistic mobile/home uplinks with wide margin. A prior
// TTL-split regression dropped this to 120s (~1.75 Mbps required), which large
// scanned PDFs routinely could not meet.
const R2_UPLOAD_TTL_SECONDS = readPositiveInt(process.env.R2_UPLOAD_TTL_SECONDS, 900);
const R2_VIEW_TTL_SECONDS = readPositiveInt(process.env.R2_VIEW_TTL_SECONDS, 7200);

export async function signPutObject(key: string, contentType: string) {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, cmd, { expiresIn: R2_UPLOAD_TTL_SECONDS });
}

export async function signGetObject(
  key: string,
  options?: {
    responseContentType?: string;
    responseContentDisposition?: string;
  }
) {
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ResponseContentType: options?.responseContentType,
    ResponseContentDisposition: options?.responseContentDisposition,
  });
  return getSignedUrl(r2, cmd, { expiresIn: R2_VIEW_TTL_SECONDS });
}

export async function headObject(key: string) {
  const cmd = new HeadObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  return r2.send(cmd);
}

export async function deleteObject(key: string) {
  const cmd = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  return r2.send(cmd);
}
