import { S3Client } from "@aws-sdk/client-s3";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function mustUrl(name: string) {
  const raw = must(name).trim().replace(/\/+$/, "");

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(`Invalid env ${name}: unsupported protocol`);
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    throw new Error(`Invalid env ${name}: expected full http(s) URL`);
  }
}

export const R2_BUCKET = must("R2_BUCKET");
export const R2_ENDPOINT = mustUrl("R2_ENDPOINT");

export const r2 = new S3Client({
  region: process.env.R2_REGION || "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: must("R2_ACCESS_KEY_ID"),
    secretAccessKey: must("R2_SECRET_ACCESS_KEY"),
  },
  forcePathStyle: true,
  maxAttempts: 3,
});
