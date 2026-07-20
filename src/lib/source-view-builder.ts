import type { SourceFile, SourceView, SourceViewCropRect, SourceViewRole } from "@/lib/types";

/**
 * Pure mapping from wizard-collected source files/views to the persisted
 * shapes, kept separate from mvp-local-project-store.ts (which is
 * browser-only, see its module doc) so id assignment, image-key linking, and
 * the "exactly one Primary View" invariant are unit-testable without
 * IndexedDB.
 */

export interface SourceFileRecordInput {
  name: string;
  kind: SourceFile["kind"];
  /** True only for raster photos whose bytes will be persisted alongside this record. */
  hasImage: boolean;
  mimeType?: string;
  dimensions?: SourceFile["dimensions"];
}

export interface SourceViewRecordInput {
  /** Index into the `sourceFiles` array passed to buildSourceRecords. */
  sourceFileIndex: number;
  crop: SourceViewCropRect;
  order: number;
  role: SourceViewRole;
  isPrimary: boolean;
}

export interface BuiltSourceRecords {
  sourceFiles: SourceFile[];
  sourceViews: SourceView[];
}

/**
 * Assigns stable ids and image keys, then builds the SourceFile and
 * SourceView records that get written to the project. Throws if a view
 * references a file with no image bytes, or if the confirmed views don't
 * have exactly one Primary View — both would silently corrupt the
 * "only the Primary View is generated" guarantee, so they're
 * rejected here rather than persisted.
 */
export function buildSourceRecords(
  projectId: string,
  now: string,
  files: SourceFileRecordInput[],
  views: SourceViewRecordInput[],
): BuiltSourceRecords {
  const sourceFiles: SourceFile[] = files.map((input, index) => {
    const id = `${projectId}-src-${index}`;
    return {
      id,
      name: input.name,
      kind: input.kind,
      uploadedAt: now,
      ...(input.hasImage ? { imageKey: `${id}:image`, mimeType: input.mimeType } : {}),
      ...(input.dimensions ? { dimensions: input.dimensions } : {}),
    };
  });

  const sourceViews: SourceView[] = views.map((input, index) => {
    const sourceFile = sourceFiles[input.sourceFileIndex];
    if (!sourceFile || !sourceFile.imageKey) {
      throw new Error(`Source view ${index} references source file ${input.sourceFileIndex} which has no stored image`);
    }
    return {
      id: `${projectId}-view-${index}`,
      sourceImageId: sourceFile.id,
      crop: input.crop,
      order: input.order,
      role: input.role,
      isPrimary: input.isPrimary,
      imageKey: sourceFile.imageKey,
    };
  });

  const primaryCount = sourceViews.filter((view) => view.isPrimary).length;
  if (sourceViews.length > 0 && primaryCount !== 1) {
    throw new Error(`Exactly one source view must be marked primary (found ${primaryCount})`);
  }

  return { sourceFiles, sourceViews };
}
