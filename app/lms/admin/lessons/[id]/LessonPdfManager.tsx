"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Trash2, Upload } from "lucide-react";

import {
  formatBytes,
  isPdfFile,
  LESSON_ASSET_MAX_SIZE_BYTES,
  LESSON_ASSET_PDF_MIME,
} from "@/lms/lib/lesson-assets";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";

type Asset = {
  id: string;
  kind: string;
  title: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number | string;
  order: number;
  is_public: boolean;
  created_at?: string;
};

function basenameWithoutExt(name: string) {
  return name.replace(/\.pdf$/i, "").trim() || name;
}

function errorText(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value) return fallback;

  switch (value) {
    case "only pdf allowed":
      return "Only PDF files are allowed.";
    case "lesson_not_found":
      return "Lesson not found.";
    case "bad lessonId":
      return "Invalid lesson scope for this PDF action.";
    case "bad file size":
      return "Could not determine the file size.";
    case "file too large":
      return `File is too large. Maximum is ${formatBytes(LESSON_ASSET_MAX_SIZE_BYTES)}.`;
    case "upload_url_generation_failed":
      return "Could not generate an upload URL for R2.";
    case "file not found in r2":
      return "File was not found in R2 after upload.";
    case "empty_file_in_r2":
      return "R2 reported an empty file.";
    case "size mismatch":
      return "Uploaded file size does not match the expected size.";
    case "unexpected_content_type":
      return "R2 returned an unexpected content type for this PDF.";
    case "storage_cleanup_failed":
      return "Could not clean up the file in R2.";
    case "unsupported_asset_kind":
      return "This asset is not a PDF lesson asset.";
    case "asset_update_failed":
      return "Server failed to update the PDF asset.";
    case "not_found":
      return "PDF asset was not found.";
    default:
      return value;
  }
}

function uploadFileWithProgress(url: string, file: File, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || LESSON_ASSET_PDF_MIME);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
    };

    xhr.onerror = () => reject(new Error("upload_failed"));
    xhr.onabort = () => reject(new Error("upload_aborted"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error(`upload_failed_${xhr.status}`));
    };

    xhr.send(file);
  });
}

export function LessonPdfManager({ lessonId }: { lessonId: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsErr, setAssetsErr] = useState<string | null>(null);
  const [assetSuccess, setAssetSuccess] = useState<string | null>(null);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadAssets() {
    setAssetsLoading(true);
    setAssetsErr(null);

    const r = await fetch(`/api/admin/lessons/${lessonId}/assets`, { method: "GET", cache: "no-store" });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      setAssetsErr(errorText(j?.message || j?.error, "Failed to load PDF assets"));
      setAssetsLoading(false);
      setAssets([]);
      return;
    }

    setAssets((j.items ?? []) as Asset[]);
    setAssetsLoading(false);
  }

  useEffect(() => {
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function patchAsset(assetId: string, patch: Partial<{ title: string | null; order: number; is_public: boolean }>) {
    setAssetsErr(null);
    setAssetSuccess(null);

    const r = await fetch(`/api/admin/assets/${assetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, lessonId }),
    });

    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) {
      setAssetsErr(errorText(j?.message || j?.error, "Failed to update PDF asset"));
      return;
    }

    await loadAssets();
  }

  async function deleteAsset(assetId: string) {
    setAssetsErr(null);
    setAssetSuccess(null);

    const r = await fetch(`/api/admin/assets/${assetId}?lessonId=${lessonId}`, { method: "DELETE" });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      setAssetsErr(errorText(j?.message || j?.error, "Failed to delete PDF asset"));
      return;
    }

    await loadAssets();
  }

  async function cleanupAsset(assetId: string) {
    await fetch(`/api/admin/assets/${assetId}?lessonId=${lessonId}`, { method: "DELETE" }).catch(() => null);
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setSelectedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFilePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setAssetSuccess(null);
    setAssetsErr(null);

    if (!file) {
      clearSelectedFile();
      return;
    }

    if (!isPdfFile(file, file.name)) {
      setAssetsErr("Only PDF files can be selected.");
      clearSelectedFile();
      return;
    }

    if (file.size > LESSON_ASSET_MAX_SIZE_BYTES) {
      setAssetsErr(`File is too large. Maximum is ${formatBytes(LESSON_ASSET_MAX_SIZE_BYTES)}.`);
      clearSelectedFile();
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
  }

  async function startAssetUpload() {
    const file = selectedFile;
    if (!file) {
      setAssetsErr("Select a PDF file first.");
      return;
    }

    setUploadingAsset(true);
    setUploadProgress(0);
    setAssetsErr(null);
    setAssetSuccess(null);

    let assetId: string | null = null;

    try {
      const title = basenameWithoutExt(file.name);

      const presignRes = await fetch(`/api/admin/lessons/${lessonId}/assets/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          filename: file.name,
          mimeType: file.type || LESSON_ASSET_PDF_MIME,
          sizeBytes: file.size,
        }),
      });

      const presignJson = await presignRes.json().catch(() => null);
      if (!presignRes.ok || !presignJson?.ok || !presignJson?.uploadUrl || !presignJson?.assetId) {
        throw new Error(errorText(presignJson?.message || presignJson?.error, "Failed to prepare PDF upload"));
      }

      assetId = String(presignJson.assetId);
      await uploadFileWithProgress(String(presignJson.uploadUrl), file, setUploadProgress);

      const completeRes = await fetch(`/api/admin/assets/${assetId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, sizeBytes: file.size, isPublic: true }),
      });

      const completeJson = await completeRes.json().catch(() => null);
      if (!completeRes.ok || !completeJson?.ok) {
        throw new Error(errorText(completeJson?.message || completeJson?.error, "Failed to finalize PDF upload"));
      }

      await loadAssets();
      setAssetSuccess(`PDF "${file.name}" uploaded successfully.`);
      clearSelectedFile();
    } catch (err) {
      if (assetId) await cleanupAsset(assetId);

      const message = err instanceof Error ? errorText(err.message, "Failed to upload PDF.") : "Failed to upload PDF.";
      setAssetsErr(message);
    } finally {
      setUploadingAsset(false);
      setUploadProgress(0);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>PDF Assets</CardTitle>
          <CardDescription>Maximum {formatBytes(LESSON_ASSET_MAX_SIZE_BYTES)}.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={loadAssets} loading={assetsLoading || uploadingAsset}>
          Refresh
        </Button>
      </CardHeader>

      <CardContent>
        <div className="rounded-2xl border border-border bg-black/10 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept={LESSON_ASSET_PDF_MIME}
              onChange={handleFilePick}
              disabled={uploadingAsset}
              className="flex-1 text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-secondary-foreground"
            />
            <Button type="button" onClick={startAssetUpload} disabled={uploadingAsset || !selectedFile} loading={uploadingAsset}>
              <Upload />
              {uploadingAsset ? "Uploading..." : "Upload PDF"}
            </Button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {selectedFileName ? `Selected file: ${selectedFileName}` : "Choose a PDF file for this lesson."}
          </p>

          {uploadingAsset ? (
            <div className="mt-3">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Uploading PDF...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          ) : null}

          {assetsErr ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive-foreground"
            >
              {assetsErr}
            </p>
          ) : null}

          {assetSuccess ? (
            <p className="mt-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-semibold text-success">
              {assetSuccess}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {assetsLoading && assets.length === 0 ? <p className="text-sm text-muted-foreground">Loading PDFs...</p> : null}
          {!assetsLoading && assets.length === 0 ? <p className="text-sm text-muted-foreground">No PDFs yet</p> : null}

          {assets.map((asset) => (
            <div key={asset.id} className="rounded-2xl border border-border bg-black/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {asset.title || asset.original_name || <span className="text-muted-foreground">(untitled)</span>}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="outline">Order {asset.order}</Badge>
                    <Badge variant={asset.is_public ? "success" : "secondary"}>
                      {asset.is_public ? "Visible" : "Hidden"}
                    </Badge>
                    <Badge variant="outline">{formatBytes(Number(asset.size_bytes || 0))}</Badge>
                  </div>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => patchAsset(asset.id, { is_public: !asset.is_public })}
                    disabled={assetsLoading || uploadingAsset}
                    aria-label={asset.is_public ? "Hide" : "Show"}
                  >
                    {asset.is_public ? <Eye /> : <EyeOff />}
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteAsset(asset.id)}
                    disabled={assetsLoading || uploadingAsset}
                    aria-label="Delete"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <p className="mt-2 truncate text-xs text-muted-foreground">{asset.original_name}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
