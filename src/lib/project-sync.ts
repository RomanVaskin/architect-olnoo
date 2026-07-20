import { getLocalProject, saveLocalProjectSync, type LocalProjectSyncRecord } from "./mvp-local-project-store";
import { buildProjectImportPackage } from "./project-import-contract";
import type { Project } from "./types";
import { getConceptReviewState, type ConceptReviewState } from "./use-concept-review";
import { createClient as createSupabaseBrowserClient } from "./supabase/client";

export interface ProjectImportResponse {
  serverProjectId: string;
  importedAt: string;
}

export interface ProjectSyncDependencies {
  loadLocalProject(localProjectId: string): Promise<Project | undefined>;
  saveSyncRecord(record: LocalProjectSyncRecord): Promise<void>;
  importProject(project: Project): Promise<ProjectImportResponse>;
  now(): string;
}

const defaultDependencies: ProjectSyncDependencies = {
  loadLocalProject: loadLocalProjectWithReview,
  saveSyncRecord: saveLocalProjectSync,
  importProject: requestProjectImport,
  now: () => new Date().toISOString(),
};

async function loadLocalProjectWithReview(localProjectId: string): Promise<Project | undefined> {
  const project = await getLocalProject(localProjectId);
  if (!project) return undefined;
  const review = getConceptReviewState(project.id, project.selectedConceptId, project.feedback);
  return applyConceptReviewToProject(project, review);
}

export function applyConceptReviewToProject(project: Project, review: ConceptReviewState): Project {
  return { ...project, selectedConceptId: review.selectedConceptId, feedback: [...review.feedback] };
}

/**
 * Copies a local project to the server. It deliberately has no local-delete
 * dependency: a successful or failed import can never remove the IndexedDB
 * source, and a retry sends the same localProjectId idempotency key.
 */
export async function syncLocalProject(
  localProjectId: string,
  dependencies: ProjectSyncDependencies = defaultDependencies,
): Promise<ProjectImportResponse> {
  const project = await dependencies.loadLocalProject(localProjectId);
  if (!project) throw new ProjectSyncError("local-project-not-found", "Локальный проект не найден в этом браузере.");

  await dependencies.saveSyncRecord({ localProjectId, status: "syncing", updatedAt: dependencies.now() });
  try {
    const result = await dependencies.importProject(project);
    await dependencies.saveSyncRecord({
      localProjectId,
      status: "synced",
      serverProjectId: result.serverProjectId,
      updatedAt: dependencies.now(),
    });
    return result;
  } catch (error) {
    const syncError = error instanceof ProjectSyncError
      ? error
      : new ProjectSyncError("import-failed", "Не удалось сохранить проект в облаке. Локальная копия не изменена.");
    await dependencies.saveSyncRecord({
      localProjectId,
      status: "failed",
      errorCode: syncError.code,
      updatedAt: dependencies.now(),
    });
    throw syncError;
  }
}

export class ProjectSyncError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ProjectSyncError";
    this.code = code;
  }
}

async function requestProjectImport(project: Project): Promise<ProjectImportResponse> {
  const projectPackage = buildProjectImportPackage(project);
  const prepared = await requestJson("/api/projects/import/prepare", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest: projectPackage.manifest }),
  });
  if (!isPreparedImport(prepared)) throw new ProjectSyncError("invalid-import-response", "Сервер вернул неполный план загрузки. Локальная копия не изменена.");

  const assetsByField = new Map(projectPackage.assets.map((asset) => [asset.descriptor.field, asset]));
  const supabase = createSupabaseBrowserClient();
  for (const target of prepared.uploads) {
    const asset = assetsByField.get(target.field);
    if (!asset) throw new ProjectSyncError("invalid-import-response", "Сервер запросил неизвестный файл. Локальная копия не изменена.");
    const result = await supabase.storage.from("project-assets").upload(target.path, asset.blob, {
      contentType: asset.descriptor.mimeType,
      upsert: true,
    });
    if (result.error) throw new ProjectSyncError("storage-upload-failed", "Не удалось загрузить один из файлов. Повтор продолжит тот же импорт; локальная копия не изменена.");
  }

  const completed = await requestJson("/api/projects/import/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest: projectPackage.manifest }),
  });
  if (!isRecord(completed) || typeof completed.serverProjectId !== "string" || typeof completed.importedAt !== "string") {
    throw new ProjectSyncError("invalid-import-response", "Сервер не подтвердил импорт. Повтор продолжит тот же импорт; локальная копия не изменена.");
  }
  return { serverProjectId: completed.serverProjectId, importedAt: completed.importedAt };
}

async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  const body = await readJson(response);
  if (!response.ok) {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    throw new ProjectSyncError(
      error && typeof error.code === "string" ? error.code : "import-failed",
      error && typeof error.message === "string" ? error.message : "Не удалось сохранить проект в облаке. Локальная копия не изменена.",
    );
  }
  return body;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isPreparedImport(value: unknown): value is { serverProjectId: string; uploads: Array<{ field: string; path: string }> } {
  return isRecord(value)
    && typeof value.serverProjectId === "string"
    && Array.isArray(value.uploads)
    && value.uploads.every((item) => isRecord(item) && typeof item.field === "string" && typeof item.path === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
