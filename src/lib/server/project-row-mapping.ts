import type {
  ActivityEvent,
  Concept,
  ConceptSourceProvenance,
  ConceptVersionEntry,
  Feedback,
  GenerationMode,
  GeometryVerificationReport,
  Project,
  ProjectBrief,
  ProjectLifecycleStage,
  ProjectState,
  Site,
  SourceFile,
  SourceView,
  SourceViewCropRect,
  SourceViewRole,
} from "@/lib/types";

/**
 * Pure row -> application-model mapping for every table read by the server
 * project repository (project-repository.ts). Column names mirror
 * supabase/migrations/202607200001_backend_foundation.sql exactly. Kept free
 * of any Supabase client so it can be unit tested with plain object
 * fixtures — see project-row-mapping.test.ts.
 */

export interface ProjectRow {
  id: string;
  name: string;
  building_type: string;
  lifecycle_stage: string;
  state: string;
  site: unknown;
  brief: unknown;
  selected_concept_id: string | null;
  updated_at: string;
}

export interface ProjectFileRow {
  id: string;
  kind: string;
  name: string;
  mime_type: string | null;
  metadata: unknown;
  created_at: string;
}

export interface SourceViewRow {
  id: string;
  source_file_id: string;
  role: string;
  crop: unknown;
  sort_order: number;
  is_primary: boolean;
}

export interface ConceptRow {
  id: string;
  parent_concept_id: string | null;
  image_file_id: string | null;
  label: string;
  state: string;
  summary: string;
  change_explanation: string;
  generation_mode: string | null;
  warnings: unknown;
  source_provenance: unknown;
  geometry_verification: unknown;
  created_at: string;
}

export interface ConceptVersionRow {
  id: string;
  concept_id: string;
  label: string;
  change_summary: string;
  created_at: string;
}

export interface ConceptFeedbackRow {
  id: string;
  concept_id: string;
  author_name: string;
  comment: string;
  created_at: string;
}

export interface ActivityEventRow {
  id: string;
  actor_type: string;
  action: string;
  metadata: unknown;
  created_at: string;
}

export function mapProjectRow(row: ProjectRow): Omit<Project, "sourceFiles" | "sourceViews" | "concepts" | "versions" | "feedback" | "activity" | "coverImage"> {
  return {
    id: row.id,
    name: row.name,
    buildingType: row.building_type,
    lifecycleStage: row.lifecycle_stage as ProjectLifecycleStage,
    state: row.state as ProjectState,
    updatedAt: row.updated_at,
    site: asSite(row.site),
    brief: asBrief(row.brief),
    selectedConceptId: row.selected_concept_id,
  };
}

export function mapSourceFileRow(row: ProjectFileRow, imageUrl: string | null): SourceFile {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  return {
    id: row.id,
    name: row.name,
    kind: (row.kind === "photo" || row.kind === "drawing" || row.kind === "document" ? row.kind : "document") as SourceFile["kind"],
    uploadedAt: typeof metadata.uploadedAt === "string" ? metadata.uploadedAt : row.created_at,
    mimeType: row.mime_type ?? undefined,
    dimensions: isRecord(metadata.dimensions)
      ? { width: Number(metadata.dimensions.width) || 0, height: Number(metadata.dimensions.height) || 0 }
      : undefined,
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export function mapSourceViewRow(row: SourceViewRow): SourceView {
  return {
    id: row.id,
    sourceImageId: row.source_file_id,
    crop: asCropRect(row.crop),
    order: row.sort_order,
    role: (VALID_SOURCE_VIEW_ROLES.has(row.role) ? row.role : "other") as SourceViewRole,
    isPrimary: row.is_primary,
    // No IndexedDB byte key exists server-side; the source file's own
    // signed imageUrl (see mapSourceFileRow) is what rendering uses.
    imageKey: row.source_file_id,
  };
}

export function mapConceptRow(row: ConceptRow, imageUrl: string | null): Concept {
  const warnings = Array.isArray(row.warnings) ? row.warnings.filter((item): item is string => typeof item === "string") : [];
  const concept: Concept = {
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    state: row.state as ProjectState,
    summary: row.summary,
    changeExplanation: row.change_explanation,
  };
  if (row.generation_mode || imageUrl) {
    concept.generatedImage = {
      mimeType: "image/jpeg",
      mode: (row.generation_mode ?? "auto") as GenerationMode,
      warnings,
      ...(imageUrl ? { url: imageUrl, ...(row.image_file_id ? { fileId: row.image_file_id } : {}) } : {}),
    };
  }
  const provenance = asSourceProvenance(row.source_provenance);
  if (provenance) concept.sourceProvenance = provenance;
  const geometryVerification = asGeometryVerification(row.geometry_verification);
  if (geometryVerification) concept.geometryVerification = geometryVerification;
  if (row.parent_concept_id) concept.parentConceptId = row.parent_concept_id;
  return concept;
}

export function mapConceptVersionRow(row: ConceptVersionRow): ConceptVersionEntry {
  return {
    id: row.id,
    conceptId: row.concept_id,
    label: row.label,
    createdAt: row.created_at,
    changeSummary: row.change_summary,
  };
}

export function mapFeedbackRow(row: ConceptFeedbackRow): Feedback {
  return {
    id: row.id,
    conceptId: row.concept_id,
    author: row.author_name || "Пользователь",
    createdAt: row.created_at,
    comment: row.comment,
  };
}

export function mapActivityEventRow(row: ActivityEventRow): ActivityEvent {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const actorType = row.actor_type === "agent" ? "agent" : "user";
  return {
    id: row.id,
    actor: typeof metadata.actorName === "string" ? metadata.actorName : actorType === "agent" ? "AI Architect" : "Пользователь",
    actorType,
    action: row.action,
    createdAt: row.created_at,
  };
}

function asSite(value: unknown): Site {
  const record = isRecord(value) ? value : {};
  return {
    address: typeof record.address === "string" ? record.address : "",
    climateZone: typeof record.climateZone === "string" ? record.climateZone : "",
    areaSqm: typeof record.areaSqm === "number" ? record.areaSqm : 0,
  };
}

function asBrief(value: unknown): ProjectBrief {
  const record = isRecord(value) ? value : {};
  return {
    goal: typeof record.goal === "string" ? record.goal : "",
    mustKeep: asStringArray(record.mustKeep),
    mayChange: asStringArray(record.mayChange),
    wantsChanged: asStringArray(record.wantsChanged),
    ...(typeof record.budgetNote === "string" ? { budgetNote: record.budgetNote } : {}),
  };
}

function asCropRect(value: unknown): SourceViewCropRect {
  const record = isRecord(value) ? value : {};
  return {
    x: typeof record.x === "number" ? record.x : 0,
    y: typeof record.y === "number" ? record.y : 0,
    width: typeof record.width === "number" ? record.width : 0,
    height: typeof record.height === "number" ? record.height : 0,
  };
}

function asSourceProvenance(value: unknown): ConceptSourceProvenance | undefined {
  return isRecord(value) && typeof value.sourceFileId === "string" ? (value as unknown as ConceptSourceProvenance) : undefined;
}

function asGeometryVerification(value: unknown): GeometryVerificationReport | undefined {
  return isRecord(value) && typeof value.status === "string" ? (value as unknown as GeometryVerificationReport) : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const VALID_SOURCE_VIEW_ROLES = new Set(["front", "side", "rear", "detail", "other"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
