import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "@/lms/server/r2/client";

function readPositiveInt(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const R2_UPLOAD_TTL_SECONDS = readPositiveInt(process.env.R2_UPLOAD_TTL_SECONDS, 120);
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
