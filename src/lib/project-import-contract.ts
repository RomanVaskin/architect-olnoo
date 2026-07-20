import type {
  Concept,
  GeneratedConceptImage,
  Project,
  SourceFile,
} from "@/lib/types";

export const PROJECT_IMPORT_VERSION = 1 as const;
export const MAX_IMPORT_ASSETS = 64;
export const MAX_IMPORT_ASSET_BYTES = 50 * 1024 * 1024;
export const MAX_IMPORT_TOTAL_BYTES = 150 * 1024 * 1024;
const ALLOWED_IMPORT_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export interface ProjectImportAssetDescriptor {
  field: string;
  ownerType: "source-file" | "concept";
  ownerId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export type ImportedSourceFile = Omit<SourceFile, "imageBlob"> & { assetField?: string };
export type ImportedConcept = Omit<Concept, "generatedImage"> & {
  generatedImage?: Omit<GeneratedConceptImage, "blob"> & { assetField: string };
};

export interface ProjectImportManifest {
  version: typeof PROJECT_IMPORT_VERSION;
  localProjectId: string;
  project: Omit<Project, "sourceFiles" | "sourceViews" | "concepts"> & {
    sourceFiles: ImportedSourceFile[];
    sourceViews: NonNullable<Project["sourceViews"]>;
    concepts: ImportedConcept[];
  };
  assets: ProjectImportAssetDescriptor[];
}

export interface ProjectImportAsset {
  descriptor: ProjectImportAssetDescriptor;
  blob: Blob;
}

export interface ProjectImportPackage {
  manifest: ProjectImportManifest;
  assets: ProjectImportAsset[];
}

/** Produces a JSON-safe manifest plus binary parts; it never mutates the local project. */
export function buildProjectImportPackage(project: Project): ProjectImportPackage {
  if (!project.id.startsWith("local-")) throw new Error("Only local projects can be imported.");
  const assets: ProjectImportAsset[] = [];

  const sourceFiles: ImportedSourceFile[] = project.sourceFiles.map(({ imageBlob, ...sourceFile }) => {
    if (!imageBlob) return sourceFile;
    const field = `asset-${assets.length}`;
    const descriptor: ProjectImportAssetDescriptor = {
      field,
      ownerType: "source-file",
      ownerId: sourceFile.id,
      fileName: sourceFile.name,
      mimeType: sourceFile.mimeType || imageBlob.type || "image/jpeg",
      sizeBytes: imageBlob.size,
    };
    assets.push({ descriptor, blob: imageBlob });
    return { ...sourceFile, assetField: field };
  });

  const concepts: ImportedConcept[] = project.concepts.map(({ generatedImage, ...concept }) => {
    if (!generatedImage) return concept;
    // Only local projects reach this function (checked above) and a local
    // concept's image is always a Blob, never a signed url (that only
    // exists for server-mapped concepts — see project-row-mapping.ts).
    if (!generatedImage.blob) throw new Error(`Local concept ${concept.id} is missing its image blob.`);
    const field = `asset-${assets.length}`;
    const descriptor: ProjectImportAssetDescriptor = {
      field,
      ownerType: "concept",
      ownerId: concept.id,
      fileName: `${concept.label}.${extensionForMime(generatedImage.mimeType)}`,
      mimeType: generatedImage.mimeType,
      sizeBytes: generatedImage.blob.size,
    };
    assets.push({ descriptor, blob: generatedImage.blob });
    const { blob: _blob, ...serializableImage } = generatedImage;
    void _blob;
    return { ...concept, generatedImage: { ...serializableImage, assetField: field } };
  });

  const { sourceFiles: _sourceFiles, concepts: _concepts, ...projectFields } = project;
  void _sourceFiles;
  void _concepts;
  const manifest: ProjectImportManifest = {
    version: PROJECT_IMPORT_VERSION,
    localProjectId: project.id,
    project: { ...projectFields, sourceViews: project.sourceViews ?? [], sourceFiles, concepts },
    assets: assets.map(({ descriptor }) => descriptor),
  };
  validateProjectImportManifest(manifest);
  return { manifest, assets };
}

export function parseProjectImportManifest(raw: string): ProjectImportManifest {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Import manifest is not valid JSON.");
  }
  validateProjectImportManifest(value);
  return value;
}

export function validateProjectImportManifest(value: unknown): asserts value is ProjectImportManifest {
  if (!isRecord(value) || value.version !== PROJECT_IMPORT_VERSION) throw new Error("Unsupported import manifest version.");
  if (!isLimitedString(value.localProjectId, 200) || !value.localProjectId.startsWith("local-")) throw new Error("Invalid local project id.");
  if (!isRecord(value.project)) throw new Error("Project data is missing.");
  const project = value.project;
  if (!isLimitedString(project.id, 200) || project.id !== value.localProjectId) throw new Error("Project id does not match the import id.");
  if (!isLimitedString(project.name, 200) || !isLimitedString(project.buildingType, 120)) throw new Error("Invalid project identity.");
  if (!isRecord(project.site) || !isRecord(project.brief)) throw new Error("Invalid project brief or site.");
  if (!LIFECYCLE_STAGES.has(String(project.lifecycleStage)) || !PROJECT_STATES.has(String(project.state))) throw new Error("Invalid project state.");

  assertArray(project.sourceFiles, 50, "source files");
  assertArray(project.sourceViews, 100, "source views");
  assertArray(project.concepts, 60, "concepts");
  assertArray(project.versions, 300, "versions");
  assertArray(project.feedback, 500, "feedback");
  assertArray(project.activity, 1000, "activity events");
  assertArray(value.assets, MAX_IMPORT_ASSETS, "assets");

  const assetFields = new Set<string>();
  const assetByField = new Map<string, Record<string, unknown>>();
  let totalBytes = 0;
  for (const asset of value.assets) {
    if (!isRecord(asset) || !isLimitedString(asset.field, 80) || !/^asset-\d+$/.test(asset.field)) throw new Error("Invalid asset field.");
    if (assetFields.has(asset.field)) throw new Error("Duplicate asset field.");
    assetFields.add(asset.field);
    assetByField.set(asset.field, asset);
    if (asset.ownerType !== "source-file" && asset.ownerType !== "concept") throw new Error("Invalid asset owner type.");
    if (!isLimitedString(asset.ownerId, 300) || !isLimitedString(asset.fileName, 300) || !isLimitedString(asset.mimeType, 120)) throw new Error("Invalid asset metadata.");
    if (!ALLOWED_IMPORT_MIME_TYPES.has(asset.mimeType)) throw new Error("Unsupported asset type.");
    const sizeBytes = asset.sizeBytes;
    if (typeof sizeBytes !== "number" || !Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > MAX_IMPORT_ASSET_BYTES) throw new Error("Invalid asset size.");
    totalBytes += sizeBytes;
  }
  if (totalBytes > MAX_IMPORT_TOTAL_BYTES) throw new Error("Import payload is too large.");

  const referencedFields = new Set<string>();
  const sourceIds = new Set<string>();
  for (const sourceFile of project.sourceFiles) {
    if (!isRecord(sourceFile) || !isLimitedString(sourceFile.id, 300) || !isLimitedString(sourceFile.name, 300)) throw new Error("Invalid source file.");
    if (sourceIds.has(sourceFile.id) || !SOURCE_KINDS.has(String(sourceFile.kind))) throw new Error("Invalid source file.");
    sourceIds.add(sourceFile.id);
    if (sourceFile.assetField !== undefined) {
      const descriptor = assertAssetReference(sourceFile.assetField, assetByField, referencedFields);
      if (descriptor.ownerType !== "source-file" || descriptor.ownerId !== sourceFile.id) throw new Error("Asset owner does not match its source file.");
    }
  }
  const sourceViewIds = new Set<string>();
  let primaryViewCount = 0;
  for (const view of project.sourceViews) {
    if (!isRecord(view) || !isLimitedString(view.id, 300) || !sourceIds.has(String(view.sourceImageId)) || !SOURCE_VIEW_ROLES.has(String(view.role))) throw new Error("Invalid source view.");
    if (sourceViewIds.has(view.id)) throw new Error("Duplicate source view.");
    sourceViewIds.add(view.id);
    if (typeof view.order !== "number" || !Number.isSafeInteger(view.order) || view.order < 0 || typeof view.isPrimary !== "boolean") throw new Error("Invalid source view order.");
    if (!isRecord(view.crop) || !isFiniteNumber(view.crop.x) || !isFiniteNumber(view.crop.y) || !isFiniteNumber(view.crop.width) || !isFiniteNumber(view.crop.height) || view.crop.x < 0 || view.crop.y < 0 || view.crop.width <= 0 || view.crop.height <= 0) throw new Error("Invalid source view crop.");
    if (view.isPrimary) primaryViewCount += 1;
  }
  if (project.sourceViews.length > 0 && primaryViewCount !== 1) throw new Error("Exactly one source view must be primary.");
  const conceptIds = new Set<string>();
  for (const concept of project.concepts) {
    if (!isRecord(concept) || !isLimitedString(concept.id, 300) || !isLimitedString(concept.label, 240)) throw new Error("Invalid concept.");
    if (conceptIds.has(concept.id) || !PROJECT_STATES.has(String(concept.state))) throw new Error("Invalid concept.");
    conceptIds.add(concept.id);
    if (concept.generatedImage !== undefined) {
      if (!isRecord(concept.generatedImage)) throw new Error("Invalid generated image.");
      const descriptor = assertAssetReference(concept.generatedImage.assetField, assetByField, referencedFields);
      if (descriptor.ownerType !== "concept" || descriptor.ownerId !== concept.id) throw new Error("Asset owner does not match its concept.");
    }
  }
  for (const concept of project.concepts) {
    if (isRecord(concept) && concept.parentConceptId !== undefined && !conceptIds.has(String(concept.parentConceptId))) throw new Error("Concept parent is missing.");
  }
  if (project.selectedConceptId !== null && !conceptIds.has(String(project.selectedConceptId))) throw new Error("Selected concept is missing.");
  for (const version of project.versions) {
    if (!isRecord(version) || !isLimitedString(version.id, 300) || !conceptIds.has(String(version.conceptId))) throw new Error("Invalid concept version.");
  }
  for (const feedback of project.feedback) {
    if (!isRecord(feedback) || !isLimitedString(feedback.id, 300) || !conceptIds.has(String(feedback.conceptId)) || !isLimitedString(feedback.comment, 5000)) throw new Error("Invalid feedback.");
  }
  for (const event of project.activity) {
    if (!isRecord(event) || !isLimitedString(event.id, 300) || (event.actorType !== "user" && event.actorType !== "agent") || !isLimitedString(event.action, 1000)) throw new Error("Invalid activity event.");
  }
  if (referencedFields.size !== assetFields.size) throw new Error("Import contains an unreferenced asset.");
}

function assertAssetReference(
  value: unknown,
  assetByField: Map<string, Record<string, unknown>>,
  referencedFields: Set<string>,
): Record<string, unknown> {
  if (typeof value !== "string" || !assetByField.has(value)) throw new Error("Import references a missing asset.");
  if (referencedFields.has(value)) throw new Error("Import asset is referenced more than once.");
  referencedFields.add(value);
  return assetByField.get(value)!;
}

function assertArray(value: unknown, max: number, label: string): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`Invalid ${label}.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLimitedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

const LIFECYCLE_STAGES = new Set(["intake", "concept", "design-development", "professional-documentation", "construction-documentation", "construction-support", "operation-modernization"]);
const PROJECT_STATES = new Set(["draft", "in-progress", "awaiting-review", "needs-specialist-review", "approved", "blocked", "archived"]);
const SOURCE_KINDS = new Set(["photo", "drawing", "document"]);
const SOURCE_VIEW_ROLES = new Set(["front", "side", "rear", "detail", "other"]);
