"use client";

import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { Eye, EyeOff, Music, Trash2, Upload } from "lucide-react";

import { formatBytes, LESSON_ASSET_KIND_CONFIG, LESSON_ASSET_MAX_SIZE_BYTES } from "@/lms/lib/lesson-assets";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import { useLessonAssetUpload } from "./useLessonAssetUpload";

const AUDIO_MIME = LESSON_ASSET_KIND_CONFIG.audio.mime;

function isAudioFile(file: File) {
  return file.type === AUDIO_MIME || file.name.toLowerCase().endsWith(".mp3");
}

function errorText(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value) return fallback;

  switch (value) {
    case "only audio allowed":
      return "Only MP3 files are allowed.";
    case "lesson_not_found":
      return "Lesson not found.";
    case "bad lessonId":
      return "Invalid lesson scope for this audio action.";
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
      return "R2 returned an unexpected content type for this audio file.";
    case "unsupported_asset_kind":
      return "This asset is not an audio lesson asset.";
    case "asset_update_failed":
      return "Server failed to update the audio asset.";
    case "not_found":
      return "Audio asset was not found.";
    default:
      return value;
  }
}

export function LessonAudioManager({ lessonId }: { lessonId: string }) {
  const {
    assets,
    assetsLoading,
    uploading: uploadingAsset,
    progress: uploadProgress,
    error: assetsErr,
    uploadedFileName,
    upload,
    remove: deleteAsset,
    patch: patchAsset,
    refresh: loadAssets,
  } = useLessonAssetUpload(lessonId, "audio");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [pickerError, setPickerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const displayError = pickerError ?? (assetsErr ? errorText(assetsErr, "Audio action failed.") : null);
  const assetSuccess = uploadedFileName ? `Audio "${uploadedFileName}" uploaded successfully.` : null;

  function clearSelectedFile() {
    setSelectedFile(null);
    setSelectedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFilePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPickerError(null);

    if (!file) {
      clearSelectedFile();
      return;
    }

    if (!isAudioFile(file)) {
      setPickerError("Only MP3 files can be selected.");
      clearSelectedFile();
      return;
    }

    if (file.size > LESSON_ASSET_MAX_SIZE_BYTES) {
      setPickerError(`File is too large. Maximum is ${formatBytes(LESSON_ASSET_MAX_SIZE_BYTES)}.`);
      clearSelectedFile();
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
  }

  async function startAssetUpload() {
    const file = selectedFile;
    if (!file) {
      setPickerError("Select an MP3 file first.");
      return;
    }

    setPickerError(null);
    await upload(file);
    clearSelectedFile();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Audio Assets</CardTitle>
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
              accept={AUDIO_MIME}
              onChange={handleFilePick}
              disabled={uploadingAsset}
              className="flex-1 text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-secondary-foreground"
            />
            <Button type="button" onClick={startAssetUpload} disabled={uploadingAsset || !selectedFile} loading={uploadingAsset}>
              <Upload />
              {uploadingAsset ? "Uploading..." : "Upload MP3"}
            </Button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {selectedFileName ? `Selected file: ${selectedFileName}` : "Choose an MP3 file for this lesson."}
          </p>

          {uploadingAsset ? (
            <div className="mt-3">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Uploading audio...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          ) : null}

          {displayError ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive-foreground"
            >
              {displayError}
            </p>
          ) : null}

          {assetSuccess ? (
            <p className="mt-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-semibold text-success">
              {assetSuccess}
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {assetsLoading && assets.length === 0 ? <p className="text-sm text-muted-foreground">Loading audio...</p> : null}
          {!assetsLoading && assets.length === 0 ? <p className="text-sm text-muted-foreground">No audio yet</p> : null}

          {assets.map((asset) => (
            <div key={asset.id} className="rounded-2xl border border-border bg-black/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-bold">
                    <Music className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
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
