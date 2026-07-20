import { cropImageToBlob, type CropRect } from "./crop-image";
import type { ConceptSourceProvenance, ConceptSourceViewProvenance, SourceImageDimensions, SourceViewRole } from "./types";
import { fileKey, isRasterImage } from "./wizard-generation-selection";

export interface PrimaryViewInput {
  fileKey: string;
  crop: CropRect;
  order: number;
  role: SourceViewRole;
  isPrimary: boolean;
}

export interface PreparedPrimaryView {
  file: File;
  sourceFileIndex: number;
  sourceViewIndex: number;
  sourceFileKey: string;
  sourceFileName: string;
  crop: CropRect;
  role: SourceViewRole;
  dimensions: SourceImageDimensions;
  payloadSizeBytes: number;
  isPrimary: boolean;
}

export interface PreparedGenerationViews {
  views: PreparedPrimaryView[];
  totalPayloadSizeBytes: number;
}

type CropImage = (source: Blob, crop: CropRect, mimeType?: string) => Promise<Blob>;

function assertValidCrop(crop: CropRect, dimensions: SourceImageDimensions): void {
  const values = [crop.x, crop.y, crop.width, crop.height];
  if (!values.every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0) {
    throw new Error("Primary View содержит некорректную область обрезки.");
  }
  if (crop.x + crop.width > dimensions.width || crop.y + crop.height > dimensions.height) {
    throw new Error("Primary View выходит за границы исходного изображения.");
  }
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function preparedFileName(sourceName: string, mimeType: string, isPrimary: boolean, index: number): string {
  const stem = sourceName.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}._-]+/gu, "-") || "source";
  return `${stem}-${isPrimary ? "primary" : `reference-${index}`}-view.${extensionForMimeType(mimeType)}`;
}

async function prepareView(
  files: File[],
  view: PrimaryViewInput,
  sourceViewIndex: number,
  dimensionsByFileKey: Record<string, SourceImageDimensions>,
  cropImage: CropImage,
): Promise<PreparedPrimaryView> {
  const sourceFileIndex = files.findIndex((file) => fileKey(file) === view.fileKey);
  const sourceFile = files[sourceFileIndex];
  if (!sourceFile || !isRasterImage(sourceFile)) throw new Error("Исходная фотография подтверждённого ракурса не найдена.");
  const dimensions = dimensionsByFileKey[view.fileKey];
  if (!dimensions) throw new Error("Размеры исходной фотографии ещё не определены. Вернитесь к шагу «Ракурсы» и дождитесь анализа.");
  assertValidCrop(view.crop, dimensions);

  const isFullFrame = view.crop.x === 0 && view.crop.y === 0 && view.crop.width === dimensions.width && view.crop.height === dimensions.height;
  const mimeType = sourceFile.type || "image/png";
  const payloadBlob = isFullFrame ? sourceFile : await cropImage(sourceFile, view.crop, mimeType);
  if (payloadBlob.size === 0) throw new Error("Не удалось подготовить изображение подтверждённого ракурса.");
  const payloadType = payloadBlob.type || mimeType;
  const preparedFile = isFullFrame
    ? sourceFile
    : new File([payloadBlob], preparedFileName(sourceFile.name, payloadType, view.isPrimary, sourceViewIndex + 1), {
        type: payloadType,
        lastModified: sourceFile.lastModified,
      });

  return {
    file: preparedFile,
    sourceFileIndex,
    sourceViewIndex,
    sourceFileKey: view.fileKey,
    sourceFileName: sourceFile.name,
    crop: { ...view.crop },
    role: view.role,
    dimensions: { width: view.crop.width, height: view.crop.height },
    payloadSizeBytes: preparedFile.size,
    isPrimary: view.isPrimary,
  };
}

/** Primary edit target first, followed by at most two ordered reference views. */
export async function prepareGenerationViews(
  files: File[],
  views: PrimaryViewInput[],
  dimensionsByFileKey: Record<string, SourceImageDimensions>,
  cropImage: CropImage = cropImageToBlob,
): Promise<PreparedGenerationViews> {
  const indexed = views.map((view, sourceViewIndex) => ({ view, sourceViewIndex }));
  const primary = indexed.filter(({ view }) => view.isPrimary);
  if (primary.length !== 1) {
    throw new Error(`Для генерации должен быть выбран ровно один основной ракурс (найдено: ${primary.length}).`);
  }
  const references = indexed
    .filter(({ view }) => !view.isPrimary)
    .sort((a, b) => a.view.order - b.view.order)
    .slice(0, 2);
  const selected = [primary[0], ...references];
  const prepared = await Promise.all(
    selected.map(({ view, sourceViewIndex }) => prepareView(files, view, sourceViewIndex, dimensionsByFileKey, cropImage)),
  );
  return { views: prepared, totalPayloadSizeBytes: prepared.reduce((sum, item) => sum + item.payloadSizeBytes, 0) };
}

/**
 * Produces the exact single image that Phase 2 sends to the paid generation
 * endpoint. A full-frame Primary View reuses the original bytes; a partial
 * view is cropped once and the resulting File is reused for preview and
 * request payload so the user sees exactly what will be uploaded.
 */
export async function preparePrimaryViewForGeneration(
  files: File[],
  views: PrimaryViewInput[],
  dimensionsByFileKey: Record<string, SourceImageDimensions>,
  cropImage: CropImage = cropImageToBlob,
): Promise<PreparedPrimaryView> {
  return (await prepareGenerationViews(files, views.filter((view) => view.isPrimary), dimensionsByFileKey, cropImage)).views[0];
}

function buildViewProvenance(projectId: string, prepared: PreparedPrimaryView): ConceptSourceViewProvenance {
  return {
    sourceFileId: `${projectId}-src-${prepared.sourceFileIndex}`,
    sourceViewId: `${projectId}-view-${prepared.sourceViewIndex}`,
    sourceFileName: prepared.sourceFileName,
    role: prepared.role,
    crop: { ...prepared.crop },
    payload: {
      mimeType: prepared.file.type,
      width: prepared.dimensions.width,
      height: prepared.dimensions.height,
      sizeBytes: prepared.payloadSizeBytes,
    },
  };
}

export function buildConceptSourceProvenance(
  projectId: string,
  prepared: PreparedPrimaryView,
  references: PreparedPrimaryView[] = [],
): ConceptSourceProvenance {
  return {
    ...buildViewProvenance(projectId, prepared),
    ...(references.length > 0 ? { referenceViews: references.map((item) => buildViewProvenance(projectId, item)) } : {}),
  };
}
