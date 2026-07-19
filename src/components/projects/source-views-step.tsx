"use client";

import { useEffect, useMemo, useState } from "react";
import { decodeImagePixels } from "@/lib/crop-image";
import { detectCollageViews, type CollageDetectionResult, type CropRect } from "@/lib/collage-detector";
import { isRasterImage, fileKey } from "@/lib/wizard-generation-selection";
import { SOURCE_VIEW_ROLE_LABELS, type SourceImageDimensions, type SourceViewRole } from "@/lib/types";
import { CroppedImagePreview } from "@/components/ui/cropped-image-preview";
import { Card } from "@/components/ui/card";

export interface ConfirmedSourceView {
  fileKey: string;
  crop: CropRect;
  order: number;
  role: SourceViewRole;
  isPrimary: boolean;
}

export interface SourceViewsChange {
  views: ConfirmedSourceView[];
  dimensionsByFileKey: Record<string, SourceImageDimensions>;
}

interface FileDetection {
  key: string;
  status: "loading" | "ready" | "error";
  result?: CollageDetectionResult;
  dimensions?: SourceImageDimensions;
}

const ROLE_OPTIONS: SourceViewRole[] = ["front", "side", "rear", "detail", "other"];

function viewKey(fileKeyValue: string, order: number): string {
  return `${fileKeyValue}::${order}`;
}

/**
 * Source Views confirmation step: for every uploaded raster photo, proposes
 * views via the pure collage detector, lets the user preview, enable or
 * disable each one, assign a role, and choose exactly one Primary View
 * across all photos. Purely local (canvas + IndexedDB-free) — it never
 * calls the generation API; the confirmed selection is only reported up via
 * onChange for the wizard to persist once the project draft is created.
 */
export function SourceViewsStep({ files, onChange }: { files: File[]; onChange: (change: SourceViewsChange) => void }) {
  const rasterFiles = useMemo(() => files.filter(isRasterImage), [files]);
  const rasterKeys = useMemo(() => rasterFiles.map(fileKey), [rasterFiles]);
  const rasterKeysSignature = rasterKeys.join("|");

  const [detections, setDetections] = useState<Record<string, FileDetection>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [roles, setRoles] = useState<Record<string, SourceViewRole>>({});
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    rasterFiles.forEach((file) => {
      const key = fileKey(file);
      setDetections((prev) => (prev[key] ? prev : { ...prev, [key]: { key, status: "loading" } }));
      decodeImagePixels(file)
        .then(({ pixelBuffer, width, height }) => {
          if (cancelled) return;
          const result = detectCollageViews(pixelBuffer);
          setDetections((prev) => ({ ...prev, [key]: { key, status: "ready", result, dimensions: { width, height } } }));

          // Default every newly-detected view to enabled, and default-select the first view of the first file as primary.
          setEnabled((prev) => {
            const next = { ...prev };
            result.views.forEach((_, order) => {
              const vk = viewKey(key, order);
              if (!(vk in next)) next[vk] = true;
            });
            return next;
          });
          setRoles((prev) => {
            const next = { ...prev };
            result.views.forEach((_, order) => {
              const vk = viewKey(key, order);
              if (!(vk in next)) next[vk] = order === 0 ? "front" : "other";
            });
            return next;
          });
          setPrimaryKey((prev) => (prev || result.views.length === 0 ? prev : viewKey(key, 0)));
        })
        .catch(() => {
          if (!cancelled) setDetections((prev) => ({ ...prev, [key]: { key, status: "error" } }));
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the set of raster files actually changes
  }, [rasterKeysSignature]);

  useEffect(() => {
    const activeDetections = rasterFiles.map((file) => detections[fileKey(file)]).filter((d): d is FileDetection => !!d);
    const views: ConfirmedSourceView[] = [];
    const dimensionsByFileKey: Record<string, SourceImageDimensions> = {};
    let order = 0;
    for (const detection of activeDetections) {
      if (detection.dimensions) dimensionsByFileKey[detection.key] = detection.dimensions;
      detection.result?.views.forEach((view, index) => {
        const key = viewKey(detection.key, index);
        if (!enabled[key]) return;
        views.push({ fileKey: detection.key, crop: view.crop, order: order++, role: roles[key] ?? "other", isPrimary: primaryKey === key });
      });
    }
    // A view may have been the primary before it was disabled — always guarantee
    // exactly one primary among the confirmed (enabled) views, never zero.
    if (views.length > 0 && !views.some((view) => view.isPrimary)) views[0].isPrimary = true;
    onChange({ views, dimensionsByFileKey });
  }, [rasterFiles, detections, enabled, roles, primaryKey, onChange]);

  if (rasterFiles.length === 0) {
    return (
      <p className="mt-6 rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-ink-secondary">
        Среди загруженных файлов нет фотографий — ракурсы для проверки появятся, когда вы добавите хотя бы одно изображение.
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-6">
      <p className="rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-ink-secondary">
        В следующей MVP-фазе в генерацию будет передан только отмеченный ниже{" "}
        <strong className="font-medium text-ink">основной ракурс (Primary View)</strong>. Остальные включённые ракурсы сохраняются
        в проекте как материалы, но пока не генерируются.
      </p>
      {rasterFiles.map((file) => {
        const key = fileKey(file);
        const detection = detections[key];
        if (!detection || detection.status === "loading") {
          return (
            <Card key={key} className="p-4 text-sm text-ink-secondary">
              Анализ «{file.name}»…
            </Card>
          );
        }
        if (detection.status === "error" || !detection.result) {
          return (
            <Card key={key} className="p-4 text-sm text-ink-secondary">
              Не удалось проанализировать «{file.name}» — файл будет сохранён как материал без разбивки на ракурсы.
            </Card>
          );
        }
        const { result } = detection;
        return (
          <Card key={key} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink">{file.name}</p>
              <span className="text-xs text-ink-secondary">
                {result.isFallback ? "Коллаж не обнаружен — один ракурс" : `Обнаружено ракурсов: ${result.views.length}`}
              </span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {result.views.map((view, order) => {
                const vk = viewKey(key, order);
                const isEnabled = enabled[vk] ?? true;
                return (
                  <div key={vk} className="rounded-xl border border-border p-3">
                    <CroppedImagePreview
                      source={file}
                      crop={view.crop}
                      alt={`${file.name} — ракурс ${order + 1}`}
                      className="aspect-[4/3] w-full rounded-lg object-cover"
                    />
                    <label className="mt-3 flex items-center gap-2 text-xs text-ink">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => setEnabled((prev) => ({ ...prev, [vk]: !isEnabled }))}
                        className="h-4 w-4 accent-[var(--color-action)]"
                      />
                      Включить
                    </label>
                    <select
                      value={roles[vk] ?? "other"}
                      disabled={!isEnabled}
                      onChange={(event) => setRoles((prev) => ({ ...prev, [vk]: event.target.value as SourceViewRole }))}
                      className="mt-2 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink outline-none disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {SOURCE_VIEW_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    <label className="mt-2 flex items-center gap-2 text-xs text-ink">
                      <input
                        type="radio"
                        name="primary-source-view"
                        checked={primaryKey === vk}
                        disabled={!isEnabled}
                        onChange={() => setPrimaryKey(vk)}
                        className="h-4 w-4 accent-[var(--color-action)]"
                      />
                      Основной ракурс (Primary View)
                    </label>
                    <p className="mt-2 text-[11px] text-ink-secondary">Уверенность: {Math.round(view.confidence * 100)}%</p>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
