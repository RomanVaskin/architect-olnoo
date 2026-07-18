/**
 * Pure selection logic for which attached raster files are sent to the image
 * model (see src/app/api/concepts/generate/route.ts, which enforces the same
 * 1-3 raster image limit server-side). Kept separate from the wizard
 * component so the "which files get generated, which stay as materials"
 * decision is explicit and testable, rather than silently dropping files
 * past the limit.
 */

export const MAX_GENERATION_IMAGES = 3;

type FileLike = Pick<File, "name" | "size" | "type">;

export function fileKey(file: FileLike): string {
  return `${file.name}-${file.size}`;
}

export function isRasterImage(file: FileLike): boolean {
  return file.type !== "application/pdf";
}

/**
 * Recomputes the generation selection after the attached-files list changes
 * (add or remove). Keeps any previously selected file that is still present,
 * then fills remaining slots (up to MAX_GENERATION_IMAGES) with the
 * newly-added raster files in order. Never removes a file from the project —
 * only decides which raster files are sent to the model.
 */
export function reconcileGenerationSelection(files: FileLike[], previousKeys: string[]): string[] {
  const rasterKeys = files.filter(isRasterImage).map(fileKey);
  const kept = previousKeys.filter((key) => rasterKeys.includes(key));
  if (kept.length >= Math.min(MAX_GENERATION_IMAGES, rasterKeys.length)) {
    return kept;
  }
  const additions = rasterKeys.filter((key) => !kept.includes(key));
  return [...kept, ...additions].slice(0, MAX_GENERATION_IMAGES);
}

/** Toggles a single file's participation in generation, capped at MAX_GENERATION_IMAGES. */
export function toggleGenerationSelection(previousKeys: string[], key: string): string[] {
  if (previousKeys.includes(key)) {
    return previousKeys.filter((existing) => existing !== key);
  }
  if (previousKeys.length >= MAX_GENERATION_IMAGES) {
    return previousKeys;
  }
  return [...previousKeys, key];
}
