import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportedConcept, ProjectImportManifest } from "@/lib/project-import-contract";

export class ProjectImportRepositoryError extends Error {
  readonly code: "backend-not-ready" | "storage-failed" | "database-failed" | "invalid-project-reference";
  readonly stage: string;

  constructor(
    code: "backend-not-ready" | "storage-failed" | "database-failed" | "invalid-project-reference",
    stage: string,
  ) {
    super(code);
    this.name = "ProjectImportRepositoryError";
    this.code = code;
    this.stage = stage;
  }
}

export interface ImportedProjectResult {
  serverProjectId: string;
  importedAt: string;
}

export interface PreparedProjectImport {
  serverProjectId: string;
  uploads: Array<{ field: string; path: string }>;
}

export async function prepareProjectImportInSupabase(
  supabase: SupabaseClient,
  userId: string,
  manifest: ProjectImportManifest,
): Promise<PreparedProjectImport> {
  const workspaceId = await ensureWorkspace(supabase, userId);
  const projectId = await upsertProject(supabase, userId, workspaceId, manifest);
  return {
    serverProjectId: projectId,
    uploads: manifest.assets.map((asset) => ({
      field: asset.field,
      path: assetStoragePath(workspaceId, projectId, `${asset.ownerType}:${asset.ownerId}`, asset.mimeType),
    })),
  };
}

/**
 * Resumable, idempotent import. Every upsert is keyed by the local record id;
 * uploaded paths are deterministic, so a retry continues a partial import.
 */
export async function completeProjectImportInSupabase(
  supabase: SupabaseClient,
  userId: string,
  manifest: ProjectImportManifest,
): Promise<ImportedProjectResult> {
  const workspaceId = await ensureWorkspace(supabase, userId);
  const projectId = await upsertProject(supabase, userId, workspaceId, manifest);
  await verifyUploadedAssets(supabase, workspaceId, projectId, manifest);
  const fileIds = new Map<string, string>();

  for (const sourceFile of manifest.project.sourceFiles) {
    const descriptor = sourceFile.assetField
      ? manifest.assets.find((candidate) => candidate.field === sourceFile.assetField)
      : undefined;
    const storagePath = descriptor
      ? assetStoragePath(workspaceId, projectId, `source-file:${sourceFile.id}`, descriptor.mimeType)
      : null;
    const rowId = await upsertRow(
      supabase,
      "project_files",
      {
        project_id: projectId,
        client_import_key: sourceFile.id,
        created_by: userId,
        kind: sourceFile.kind,
        name: sourceFile.name,
        mime_type: sourceFile.mimeType ?? null,
        size_bytes: descriptor?.sizeBytes ?? null,
        storage_path: storagePath,
        metadata: {
          uploadedAt: sourceFile.uploadedAt,
          imageKey: sourceFile.imageKey ?? null,
          dimensions: sourceFile.dimensions ?? null,
          bytesAvailable: Boolean(storagePath),
        },
      },
      "project_id,client_import_key",
      "project-files",
    );
    fileIds.set(sourceFile.id, rowId);
  }

  const clearedPrimary = await supabase.from("source_views").update({ is_primary: false }).eq("project_id", projectId);
  failOnDatabaseError(clearedPrimary.error, "source-view-primary-reset");
  for (const view of manifest.project.sourceViews ?? []) {
    const sourceFileId = fileIds.get(view.sourceImageId);
    if (!sourceFileId) throw new ProjectImportRepositoryError("invalid-project-reference", "source-view");
    await upsertRow(
      supabase,
      "source_views",
      {
        project_id: projectId,
        client_import_key: view.id,
        source_file_id: sourceFileId,
        role: view.role,
        crop: view.crop,
        sort_order: view.order,
        is_primary: view.isPrimary,
      },
      "project_id,client_import_key",
      "source-views",
    );
  }

  const conceptFileIds = new Map<string, string>();
  for (const concept of manifest.project.concepts) {
    const image = concept.generatedImage;
    if (!image) continue;
    const descriptor = manifest.assets.find((candidate) => candidate.field === image.assetField);
    if (!descriptor) throw new ProjectImportRepositoryError("invalid-project-reference", "concept-image");
    const storagePath = assetStoragePath(workspaceId, projectId, `concept:${concept.id}`, descriptor.mimeType);
    const fileId = await upsertRow(
      supabase,
      "project_files",
      {
        project_id: projectId,
        client_import_key: `concept-image:${concept.id}`,
        created_by: userId,
        kind: "concept",
        name: descriptor.fileName,
        mime_type: descriptor.mimeType,
        size_bytes: descriptor.sizeBytes,
        storage_path: storagePath,
        metadata: { mode: image.mode, warnings: image.warnings },
      },
      "project_id,client_import_key",
      "concept-files",
    );
    conceptFileIds.set(concept.id, fileId);
  }

  const conceptIds = new Map<string, string>();
  for (const concept of manifest.project.concepts) {
    const conceptId = await upsertConcept(supabase, userId, projectId, concept, conceptFileIds.get(concept.id));
    conceptIds.set(concept.id, conceptId);
  }
  for (const concept of manifest.project.concepts) {
    if (!concept.parentConceptId) continue;
    const conceptId = conceptIds.get(concept.id);
    const parentId = conceptIds.get(concept.parentConceptId);
    if (!conceptId || !parentId) throw new ProjectImportRepositoryError("invalid-project-reference", "parent-concept");
    await updateRow(supabase, "concepts", conceptId, { parent_concept_id: parentId }, "concept-parent");
  }

  const selectedConceptId = manifest.project.selectedConceptId
    ? conceptIds.get(manifest.project.selectedConceptId)
    : null;
  if (manifest.project.selectedConceptId && !selectedConceptId) {
    throw new ProjectImportRepositoryError("invalid-project-reference", "selected-concept");
  }
  await updateRow(supabase, "projects", projectId, { selected_concept_id: selectedConceptId }, "selected-concept");

  for (const version of manifest.project.versions) {
    const conceptId = conceptIds.get(version.conceptId);
    if (!conceptId) throw new ProjectImportRepositoryError("invalid-project-reference", "concept-version");
    await upsertRow(supabase, "concept_versions", {
      project_id: projectId,
      client_import_key: version.id,
      concept_id: conceptId,
      label: version.label,
      change_summary: version.changeSummary,
      created_at: version.createdAt,
    }, "project_id,client_import_key", "concept-versions");
  }

  for (const feedback of manifest.project.feedback) {
    const conceptId = conceptIds.get(feedback.conceptId);
    if (!conceptId) throw new ProjectImportRepositoryError("invalid-project-reference", "feedback");
    await upsertRow(supabase, "concept_feedback", {
      project_id: projectId,
      client_import_key: feedback.id,
      concept_id: conceptId,
      author_user_id: userId,
      author_name: feedback.author,
      comment: feedback.comment,
      created_at: feedback.createdAt,
    }, "project_id,client_import_key", "feedback");
  }

  for (const event of manifest.project.activity) {
    await upsertRow(supabase, "activity_events", {
      project_id: projectId,
      client_import_key: event.id,
      actor_user_id: event.actorType === "user" ? userId : null,
      actor_type: event.actorType,
      action: event.action,
      metadata: { actorName: event.actor },
      created_at: event.createdAt,
    }, "project_id,client_import_key", "activity");
  }

  return { serverProjectId: projectId, importedAt: new Date().toISOString() };
}

async function ensureWorkspace(supabase: SupabaseClient, userId: string): Promise<string> {
  const existing = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userId).order("created_at").limit(1).maybeSingle();
  failOnDatabaseError(existing.error, "workspace-select");
  if (existing.data?.workspace_id) return String(existing.data.workspace_id);

  const created = await supabase.from("workspaces").insert({ name: "Личное пространство", owner_user_id: userId }).select("id").single();
  failOnDatabaseError(created.error, "workspace-create");
  return String(created.data!.id);
}

async function upsertProject(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  manifest: ProjectImportManifest,
): Promise<string> {
  const project = manifest.project;
  return upsertRow(supabase, "projects", {
    workspace_id: workspaceId,
    client_import_key: manifest.localProjectId,
    created_by: userId,
    name: project.name,
    building_type: project.buildingType,
    lifecycle_stage: project.lifecycleStage,
    state: project.state,
    site: project.site,
    brief: project.brief,
    updated_at: project.updatedAt,
  }, "workspace_id,client_import_key", "project");
}

async function upsertConcept(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  concept: ImportedConcept,
  imageFileId?: string,
): Promise<string> {
  return upsertRow(supabase, "concepts", {
    project_id: projectId,
    client_import_key: concept.id,
    parent_concept_id: null,
    created_by: userId,
    image_file_id: imageFileId ?? null,
    label: concept.label,
    state: concept.state,
    summary: concept.summary,
    change_explanation: concept.changeExplanation,
    generation_mode: concept.generatedImage?.mode ?? null,
    warnings: concept.generatedImage?.warnings ?? [],
    source_provenance: concept.sourceProvenance ?? null,
    geometry_verification: concept.geometryVerification ?? null,
    created_at: concept.createdAt,
  }, "project_id,client_import_key", "concepts");
}

function assetStoragePath(
  workspaceId: string,
  projectId: string,
  importKey: string,
  mimeType: string,
): string {
  const digest = createHash("sha256").update(importKey).digest("hex").slice(0, 32);
  return `${workspaceId}/${projectId}/${digest}.${extensionForMime(mimeType)}`;
}

async function verifyUploadedAssets(
  supabase: SupabaseClient,
  workspaceId: string,
  projectId: string,
  manifest: ProjectImportManifest,
): Promise<void> {
  if (manifest.assets.length === 0) return;
  const folder = `${workspaceId}/${projectId}`;
  const result = await supabase.storage.from("project-assets").list(folder, { limit: 100 });
  if (result.error) throw new ProjectImportRepositoryError("storage-failed", "asset-list");
  const uploadedByName = new Map((result.data ?? []).map((item) => [item.name, item]));
  for (const asset of manifest.assets) {
    const expectedPath = assetStoragePath(workspaceId, projectId, `${asset.ownerType}:${asset.ownerId}`, asset.mimeType);
    const expectedName = expectedPath.slice(folder.length + 1);
    const uploaded = uploadedByName.get(expectedName);
    if (!uploaded) throw new ProjectImportRepositoryError("storage-failed", "asset-verification");
    const metadata = isRecord(uploaded.metadata) ? uploaded.metadata : null;
    if (metadata && typeof metadata.size === "number" && metadata.size !== asset.sizeBytes) {
      throw new ProjectImportRepositoryError("storage-failed", "asset-size-verification");
    }
    if (metadata && typeof metadata.mimetype === "string" && metadata.mimetype !== asset.mimeType) {
      throw new ProjectImportRepositoryError("storage-failed", "asset-type-verification");
    }
  }
}

async function upsertRow(
  supabase: SupabaseClient,
  table: string,
  value: Record<string, unknown>,
  onConflict: string,
  stage: string,
): Promise<string> {
  const result = await supabase.from(table).upsert(value, { onConflict }).select("id").single();
  failOnDatabaseError(result.error, stage);
  return String(result.data!.id);
}

async function updateRow(
  supabase: SupabaseClient,
  table: string,
  id: string,
  value: Record<string, unknown>,
  stage: string,
): Promise<void> {
  const result = await supabase.from(table).update(value).eq("id", id);
  failOnDatabaseError(result.error, stage);
}

function failOnDatabaseError(error: { code?: string } | null, stage: string): void {
  if (!error) return;
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST205") {
    throw new ProjectImportRepositoryError("backend-not-ready", stage);
  }
  throw new ProjectImportRepositoryError("database-failed", stage);
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "application/pdf") return "pdf";
  return "jpg";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
