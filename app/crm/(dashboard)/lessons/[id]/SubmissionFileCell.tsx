"use client";

import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { useToast } from "@/crm/components/ToastProvider";
import type { Submission } from "@/crm/lib/types";
import { attachHomeworkFile, getHomeworkUploadUrl, getSubmissionFileUrl } from "../actions";

const HOMEWORK_ACCEPT = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip";

// fileKey convention: homework-submissions/{lessonId}/{studentId}/{uuid}-{name}
// (see getHomeworkUploadUrl / getSubmissionUploadUrl). Strip the leading
// UUID+dash to show just the original filename.
function fileNameFromKey(fileKey: string): string {
  const last = fileKey.split("/").pop() ?? fileKey;
  return last.replace(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-/,
    "",
  );
}

function uploadFileWithProgress(url: string, file: File, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
    };
    xhr.onerror = () => reject(new Error("upload_failed"));
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

export function SubmissionFileCell({
  lessonId,
  studentId,
  submission,
  disabled,
}: {
  lessonId: string;
  studentId: string;
  submission: Submission | undefined;
  disabled: boolean;
}) {
  const showToast = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [opening, setOpening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fileKey = submission?.fileKey ?? null;

  const handleFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    try {
      const presign = await getHomeworkUploadUrl(lessonId, studentId, {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      if (presign.error !== undefined) {
        showToast(presign.error, "error");
        return;
      }
      await uploadFileWithProgress(presign.uploadUrl, file, setProgress);
      const attached = await attachHomeworkFile(lessonId, studentId, presign.fileKey);
      if (attached.error !== undefined) {
        showToast(attached.error, "error");
        return;
      }
      showToast("Файл прикреплён");
    } catch {
      showToast("Не удалось загрузить файл", "error");
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      const result = await attachHomeworkFile(lessonId, studentId, null);
      if (result.error !== undefined) {
        showToast(result.error, "error");
        return;
      }
      showToast("Файл удалён");
    } catch {
      showToast("Не удалось удалить файл", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async () => {
    if (!submission) return;
    setOpening(true);
    try {
      const result = await getSubmissionFileUrl(submission.id);
      if (result.error !== undefined) {
        showToast(result.error, "error");
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch {
      showToast("Не удалось открыть файл", "error");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {fileKey ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleOpen}
            disabled={opening}
            className="truncate text-xs font-medium text-accent underline-offset-2 hover:underline disabled:opacity-50"
            title={fileNameFromKey(fileKey)}
          >
            {fileNameFromKey(fileKey)}
          </button>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="text-xs text-rose-600 hover:underline disabled:opacity-50"
            >
              Удалить
            </button>
          )}
        </div>
      ) : (
        <span className="text-xs text-slate-400">Нет файла</span>
      )}

      {!disabled && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={HOMEWORK_ACCEPT}
            disabled={uploading}
            onChange={handleFilePick}
            className="text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-700"
          />
          {uploading && (
            <span className="text-[11px] text-slate-400">Загрузка... {progress}%</span>
          )}
        </>
      )}
    </div>
  );
}
