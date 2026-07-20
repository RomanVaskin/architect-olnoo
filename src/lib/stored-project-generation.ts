import { fileKey } from "./wizard-generation-selection";
import type { PreparedGenerationViews, PrimaryViewInput } from "./primary-view-generation";
import type { GenerationMode, Project, ProjectBrief, SourceImageDimensions, SourceView } from "./types";

/**
 * Rebuilds the New Project wizard's generation inputs from a project that
 * was already persisted to IndexedDB, so a paid generation can be started
 * later from the Concepts section of a saved draft without recreating the
 * project or re-uploading anything.
 *
 * The files array stays positionally aligned with project.sourceFiles —
 * including placeholder entries for files whose bytes are not raster images —
 * because buildConceptSourceProvenance derives `<projectId>-src-<index>` /
 * `<projectId>-view-<index>` ids from array indices, and buildSourceRecords
 * assigned exactly those ids when the draft was saved. Misaligned indices
 * would silently attach a concept's provenance to the wrong stored record.
 */

export interface StoredProjectGenerationInputs {
  files: File[];
  views: PrimaryViewInput[];
  dimensionsByFileKey: Record<string, SourceImageDimensions>;
}

/** The views a generation would actually send: the Primary View plus at most two references — mirrors prepareGenerationViews. */
function selectedGenerationViews(views: SourceView[]): SourceView[] {
  const primary = views.filter((view) => view.isPrimary);
  const references = views
    .filter((view) => !view.isPrimary)
    .sort((a, b) => a.order - b.order)
    .slice(0, 2);
  return [...primary, ...references];
}

/**
 * True only when the stored project has everything a paid generation needs:
 * exactly one Primary View, and stored image bytes plus known dimensions for
 * every view that would be sent. Used to decide whether the Concepts section
 * offers «Сгенерировать концепцию» for a local draft at all.
 */
export function canGenerateFromStoredProject(project: Project): boolean {
  const views = project.sourceViews ?? [];
  if (views.filter((view) => view.isPrimary).length !== 1) return false;
  return selectedGenerationViews(views).every((view) => {
    const source = project.sourceFiles.find((file) => file.id === view.sourceImageId);
    return Boolean(source?.imageBlob && source.dimensions);
  });
}

export function buildStoredProjectGenerationInputs(project: Project): StoredProjectGenerationInputs {
  const files: File[] = project.sourceFiles.map((source) =>
    source.imageBlob
      ? new File([source.imageBlob], source.name, { type: source.mimeType || source.imageBlob.type || "image/png" })
      : // Placeholder keeps the index aligned; typed non-raster so prepareView fails fast if a view ever references it.
        new File([], source.name, { type: "application/pdf" }),
  );

  const dimensionsByFileKey: Record<string, SourceImageDimensions> = {};
  project.sourceFiles.forEach((source, index) => {
    if (source.dimensions) dimensionsByFileKey[fileKey(files[index])] = source.dimensions;
  });

  const fileKeyBySourceId = new Map(project.sourceFiles.map((source, index) => [source.id, fileKey(files[index])]));
  const views: PrimaryViewInput[] = (project.sourceViews ?? []).map((view) => {
    const key = fileKeyBySourceId.get(view.sourceImageId);
    if (!key) throw new Error("Подтверждённый ракурс ссылается на исходный файл, которого больше нет в проекте.");
    return { fileKey: key, crop: { ...view.crop }, order: view.order, role: view.role, isPrimary: view.isPrimary };
  });

  return { files, views, dimensionsByFileKey };
}

export interface LocalGenerationRequestOptions {
  mode: GenerationMode;
  variantCount: 1 | 3;
  autoReview: boolean;
}

/**
 * Exactly the multipart body the New Project wizard sends to the existing
 * POST /api/concepts/generate route — kept byte-for-byte compatible so
 * starting generation later from a saved draft exercises the same paid local
 * route contract, validation, and safeguards as generating from the wizard.
 */
export function buildLocalGenerationFormData(
  prepared: PreparedGenerationViews,
  brief: ProjectBrief,
  options: LocalGenerationRequestOptions,
): FormData {
  const formData = new FormData();
  prepared.views.forEach((view) => formData.append("images", view.file));
  formData.append(
    "imageContexts",
    JSON.stringify(prepared.views.map((view) => ({ role: view.role, purpose: view.isPrimary ? "primary" : "reference" }))),
  );
  formData.append("goal", brief.goal);
  formData.append("explicitChanges", brief.wantsChanged.join("; "));
  formData.append("mustKeep", JSON.stringify(brief.mustKeep));
  formData.append("mayChange", JSON.stringify(brief.mayChange));
  formData.append("mode", options.mode);
  formData.append("variantCount", String(options.variantCount));
  formData.append("autoReview", String(options.autoReview));
  return formData;
}
