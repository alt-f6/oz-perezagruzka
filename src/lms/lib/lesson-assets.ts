function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const LESSON_ASSET_PDF_MIME = "application/pdf";
export const LESSON_ASSET_MAX_SIZE_BYTES = readPositiveIntEnv(
  "NEXT_PUBLIC_LESSON_ASSET_MAX_SIZE_BYTES",
  25 * 1024 * 1024
);

export function formatBytes(size: number) {
  if (!Number.isFinite(size) || size < 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function isPdfFile(file: File | Blob, fileName?: string) {
  const mimeType = "type" in file ? String(file.type || "") : "";
  const name = typeof fileName === "string" ? fileName : "name" in file ? String(file.name || "") : "";
  return mimeType === LESSON_ASSET_PDF_MIME || name.toLowerCase().endsWith(".pdf");
}

export function readLessonAssetScope(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildInlineContentDisposition(filename: string) {
  const safe = filename.replace(/["\\\r\n]/g, "_");
  return `inline; filename="${safe}"`;
}
