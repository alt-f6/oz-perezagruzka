"use client";

import { useCallback, useEffect, useState } from "react";

import { LESSON_ASSET_KIND_CONFIG, type LessonAssetKind } from "@/lms/lib/lesson-assets";

export type LessonAssetRow = {
  id: string;
  kind: string;
  title: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  order: number;
  is_public: boolean;
  created_at?: string;
};

function basenameWithoutExt(name: string, extension: RegExp) {
  return name.replace(extension, "").trim() || name;
}

function uploadFileWithProgress(url: string, file: File, mimeType: string, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || mimeType);

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

/**
 * The single client-side home for the lesson-asset presign -> PUT -> complete
 * -> list -> delete flow. `LessonPdfManager` and `LessonAudioManager` are thin
 * presentational wrappers around this hook; the endpoints/payload shapes here
 * mirror the real `/api/admin/lessons/[id]/assets*` and `/api/admin/assets/[id]*`
 * routes (not a generic assumption) since those routes are what the PDF flow
 * has always talked to.
 *
 * Note: `GET /api/admin/lessons/[id]/assets` returns every asset kind for the
 * lesson (no server-side `kind` filter), so this hook filters client-side.
 */
export function useLessonAssetUpload(lessonId: string, kind: LessonAssetKind) {
  const [assets, setAssets] = useState<LessonAssetRow[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const refresh = useCallback(async () => {
    setAssetsLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/lessons/${lessonId}/assets`, { method: "GET", cache: "no-store" });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      setError(json?.message || json?.error || "load_failed");
      setAssetsLoading(false);
      setAssets([]);
      return;
    }

    const items = (json.items ?? []) as LessonAssetRow[];
    setAssets(items.filter((item) => item.kind === kind));
    setAssetsLoading(false);
  }, [lessonId, kind]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, kind]);

  const cleanupOrphan = useCallback(
    async (assetId: string) => {
      await fetch(`/api/admin/assets/${assetId}?lessonId=${lessonId}`, { method: "DELETE" }).catch(() => null);
    },
    [lessonId]
  );

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setProgress(0);
      setError(null);
      setUploadedFileName(null);

      let assetId: string | null = null;
      const config = LESSON_ASSET_KIND_CONFIG[kind];

      try {
        const title = basenameWithoutExt(file.name, config.extension);

        const presignRes = await fetch(`/api/admin/lessons/${lessonId}/assets/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            title,
            filename: file.name,
            mimeType: file.type || config.mime,
            sizeBytes: file.size,
          }),
        });

        const presignJson = await presignRes.json().catch(() => null);
        if (!presignRes.ok || !presignJson?.ok || !presignJson?.uploadUrl || !presignJson?.assetId) {
          setError(presignJson?.message || presignJson?.error || "upload_failed");
          return;
        }

        assetId = String(presignJson.assetId);
        await uploadFileWithProgress(String(presignJson.uploadUrl), file, config.mime, setProgress);

        const completeRes = await fetch(`/api/admin/assets/${assetId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, sizeBytes: file.size, isPublic: true }),
        });

        const completeJson = await completeRes.json().catch(() => null);
        if (!completeRes.ok || !completeJson?.ok) {
          setError(completeJson?.message || completeJson?.error || "upload_failed");
          if (assetId) await cleanupOrphan(assetId);
          return;
        }

        await refresh();
        setUploadedFileName(file.name);
      } catch (err) {
        if (assetId) await cleanupOrphan(assetId);
        setError(err instanceof Error ? err.message : "upload_failed");
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [lessonId, kind, refresh, cleanupOrphan]
  );

  const remove = useCallback(
    async (assetId: string) => {
      setError(null);
      setUploadedFileName(null);

      const res = await fetch(`/api/admin/assets/${assetId}?lessonId=${lessonId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setError(json?.message || json?.error || "delete_failed");
        return;
      }

      await refresh();
    },
    [lessonId, refresh]
  );

  const patch = useCallback(
    async (assetId: string, patchBody: Partial<{ title: string | null; order: number; is_public: boolean }>) => {
      setError(null);
      setUploadedFileName(null);

      const res = await fetch(`/api/admin/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patchBody, lessonId }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.message || json?.error || "update_failed");
        return;
      }

      await refresh();
    },
    [lessonId, refresh]
  );

  return { assets, assetsLoading, uploading, progress, error, uploadedFileName, upload, remove, patch, refresh };
}
