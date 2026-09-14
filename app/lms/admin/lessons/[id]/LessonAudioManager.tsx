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
      return "Разрешены только MP3-файлы.";
    case "lesson_not_found":
      return "Урок не найден.";
    case "bad lessonId":
      return "Некорректный урок для этого действия с аудио.";
    case "bad file size":
      return "Не удалось определить размер файла.";
    case "file too large":
      return `Файл слишком большой. Максимум ${formatBytes(LESSON_ASSET_MAX_SIZE_BYTES)}.`;
    case "upload_url_generation_failed":
      return "Не удалось создать ссылку для загрузки в R2.";
    case "file not found in r2":
      return "Файл не найден в R2 после загрузки.";
    case "empty_file_in_r2":
      return "R2 сообщил, что файл пустой.";
    case "size mismatch":
      return "Размер загруженного файла не совпадает с ожидаемым.";
    case "unexpected_content_type":
      return "R2 вернул неожиданный тип содержимого для этого аудиофайла.";
    case "unsupported_asset_kind":
      return "Это вложение не является аудиофайлом урока.";
    case "asset_update_failed":
      return "Не удалось обновить аудиофайл на сервере.";
    case "not_found":
      return "Аудиофайл не найден.";
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

  const displayError = pickerError ?? (assetsErr ? errorText(assetsErr, "Действие с аудио не выполнено.") : null);
  const assetSuccess = uploadedFileName ? `Аудио «${uploadedFileName}» успешно загружено.` : null;

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
      setPickerError("Можно выбрать только MP3-файлы.");
      clearSelectedFile();
      return;
    }

    if (file.size > LESSON_ASSET_MAX_SIZE_BYTES) {
      setPickerError(`Файл слишком большой. Максимум ${formatBytes(LESSON_ASSET_MAX_SIZE_BYTES)}.`);
      clearSelectedFile();
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
  }

  async function startAssetUpload() {
    const file = selectedFile;
    if (!file) {
      setPickerError("Сначала выберите MP3-файл.");
      return;
    }

    setPickerError(null);
    const succeeded = await upload(file);
    if (succeeded) clearSelectedFile();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Аудиофайлы</CardTitle>
          <CardDescription>Максимум {formatBytes(LESSON_ASSET_MAX_SIZE_BYTES)}.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={loadAssets} loading={assetsLoading || uploadingAsset}>
          Обновить
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
              {uploadingAsset ? "Загрузка..." : "Загрузить MP3"}
            </Button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {selectedFileName ? `Выбран файл: ${selectedFileName}` : "Выберите MP3-файл для этого урока."}
          </p>

          {uploadingAsset ? (
            <div className="mt-3">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Загрузка аудио...</span>
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
          {assetsLoading && assets.length === 0 ? <p className="text-sm text-muted-foreground">Загрузка аудио...</p> : null}
          {!assetsLoading && assets.length === 0 ? <p className="text-sm text-muted-foreground">Пока нет аудио</p> : null}

          {assets.map((asset) => (
            <div key={asset.id} className="rounded-2xl border border-border bg-black/10 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-bold">
                    <Music className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {asset.title || asset.original_name || <span className="text-muted-foreground">(без названия)</span>}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant="outline">Порядок {asset.order}</Badge>
                    <Badge variant={asset.is_public ? "success" : "secondary"}>
                      {asset.is_public ? "Виден" : "Скрыт"}
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
                    aria-label={asset.is_public ? "Скрыть" : "Показать"}
                  >
                    {asset.is_public ? <Eye /> : <EyeOff />}
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteAsset(asset.id)}
                    disabled={assetsLoading || uploadingAsset}
                    aria-label="Удалить"
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
