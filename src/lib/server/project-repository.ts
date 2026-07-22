import type { SupabaseClient } from "@supabase/supabase-js";
import type { Concept, Feedback, Project, ProjectLifecycleStage, ProjectState, Site } from "@/lib/types";
import { resolveProjectCover } from "../project-cover";
import { signPath, signPaths } from "./project-assets";
import {
  mapActivityEventRow,
  mapConceptRow,
  mapConceptVersionRow,
  mapFeedbackRow,
  mapProjectRow,
  mapSourceFileRow,
  mapSourceViewRow,
  type ActivityEventRow,
  type ConceptFeedbackRow,
  type ConceptRow,
  type ConceptVersionRow,
  type ProjectFileRow,
  type ProjectRow,
  type SourceViewRow,
} from "./project-row-mapping";

export class ProjectRepositoryError extends Error {
  readonly code: "not-found" | "database-failed" | "invalid-request";
  readonly stage: string;

  constructor(code: "not-found" | "database-failed" | "invalid-request", stage: string) {
    super(code);
    this.name = "ProjectRepositoryError";
    this.code = code;
    this.stage = stage;
  }
}

/** Fields the /projects list actually renders (see ProjectCard) — deliberately narrower than Project so a summary never claims empty arrays it hasn't fetched. */
export interface ServerProjectSummary {
  id: string;
  name: string;
  buildingType: string;
  coverImage: string;
  lifecycleStage: ProjectLifecycleStage;
  state: ProjectState;
  updatedAt: string;
  site: Site;
}

const PROJECT_COLUMNS = "id,name,building_type,lifecycle_stage,state,site,brief,selected_concept_id,updated_at";

export async function listServerProjects(supabase: SupabaseClient): Promise<ServerProjectSummary[]> {
  const projectsResult = await supabase.from("projects").select(PROJECT_COLUMNS).order("updated_at", { ascending: false });
  failOnDatabaseError(projectsResult.error, "projects-list");
  const rows = (projectsResult.data ?? []) as ProjectRow[];
  if (rows.length === 0) return [];

  const projectIds = rows.map((row) => row.id);
  const coverPathByProject = await resolveCoverPaths(supabase, projectIds);
  const signedByPath = new Map<string, string | null>();
  const uniquePaths = Array.from(new Set(Array.from(coverPathByProject.values()).filter((path): path is string => Boolean(path))));
  const signed = await signPaths(supabase, uniquePaths);
  uniquePaths.forEach((path, index) => signedByPath.set(path, signed[index]));

  return rows.map((row) => {
    const project = mapProjectRow(row);
    const coverPath = coverPathByProject.get(row.id) ?? null;
    return { ...project, coverImage: (coverPath ? signedByPath.get(coverPath) : null) ?? "" };
  });
}

/**
 * The newest concept image, or else the primary-source-view file, per
 * project — the same priority `resolveProjectCover` (src/lib/project-cover.ts)
 * applies once a project's full concepts/sourceViews/sourceFiles are loaded,
 * reimplemented here at the raw storage-path level so the list endpoint can
 * batch-sign only the one path each project actually needs instead of
 * fetching and signing every file for every project up front. The primary
 * view's file can legitimately be any source kind (`photo`, `drawing`,
 * `document` — nothing constrains a Primary Source View to a photo), so the
 * lookup below is not narrowed to `photo` alone.
 */
async function resolveCoverPaths(supabase: SupabaseClient, projectIds: string[]): Promise<Map<string, string>> {
  const covers = new Map<string, string>();

  const [primaryViews, files] = await Promise.all([
    supabase.from("source_views").select("project_id,source_file_id").in("project_id", projectIds).eq("is_primary", true),
    supabase
      .from("project_files")
      .select("id,project_id,kind,storage_path,created_at")
      .in("project_id", projectIds)
      .in("kind", ["photo", "drawing", "document", "concept"])
      .not("storage_path", "is", null)
      .order("created_at", { ascending: false }),
  ]);
  failOnDatabaseError(primaryViews.error, "cover-primary-views");
  failOnDatabaseError(files.error, "cover-files");

  const primaryFileIdByProject = new Map<string, string>();
  for (const row of (primaryViews.data ?? []) as Array<{ project_id: string; source_file_id: string }>) {
    primaryFileIdByProject.set(row.project_id, row.source_file_id);
  }

  const newestConceptByProject = new Map<string, string>();
  const fileById = new Map<string, { project_id: string; storage_path: string }>();
  for (const row of (files.data ?? []) as Array<{ id: string; project_id: string; kind: string; storage_path: string | null }>) {
    if (!row.storage_path) continue;
    fileById.set(row.id, { project_id: row.project_id, storage_path: row.storage_path });
    if (row.kind === "concept" && !newestConceptByProject.has(row.project_id)) {
      newestConceptByProject.set(row.project_id, row.storage_path);
    }
  }

  for (const projectId of projectIds) {
    const primaryFileId = primaryFileIdByProject.get(projectId);
    const primaryPath = primaryFileId ? fileById.get(primaryFileId)?.storage_path : undefined;
    const path = newestConceptByProject.get(projectId) ?? primaryPath;
    if (path) covers.set(projectId, path);
  }
  return covers;
}

export async function getServerProjectDetail(supabase: SupabaseClient, projectId: string): Promise<Project> {
  const projectResult = await supabase.from("projects").select(PROJECT_COLUMNS).eq("id", projectId).maybeSingle();
  failOnDatabaseError(projectResult.error, "project-detail");
  if (!projectResult.data) throw new ProjectRepositoryError("not-found", "project-detail");
  const projectRow = projectResult.data as ProjectRow;

  const [filesResult, viewsResult, conceptsResult, versionsResult, feedbackResult, activityResult] = await Promise.all([
    supabase.from("project_files").select("id,kind,name,mime_type,storage_path,metadata,created_at").eq("project_id", projectId),
    supabase.from("source_views").select("id,source_file_id,role,crop,sort_order,is_primary").eq("project_id", projectId).order("sort_order"),
    supabase.from("concepts").select("id,parent_concept_id,image_file_id,label,state,summary,change_explanation,generation_mode,warnings,source_provenance,geometry_verification,created_at").eq("project_id", projectId).order("created_at"),
    supabase.from("concept_versions").select("id,concept_id,label,change_summary,created_at").eq("project_id", projectId).order("created_at"),
    supabase.from("concept_feedback").select("id,concept_id,author_name,comment,created_at").eq("project_id", projectId).order("created_at"),
    supabase.from("activity_events").select("id,actor_type,action,metadata,created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
  ]);
  failOnDatabaseError(filesResult.error, "project-files");
  failOnDatabaseError(viewsResult.error, "source-views");
  failOnDatabaseError(conceptsResult.error, "concepts");
  failOnDatabaseError(versionsResult.error, "concept-versions");
  failOnDatabaseError(feedbackResult.error, "concept-feedback");
  failOnDatabaseError(activityResult.error, "activity-events");

  const fileRows = (filesResult.data ?? []) as (ProjectFileRow & { storage_path: string | null })[];
  const paths = fileRows.map((row) => row.storage_path);
  const signedUrls = await signPaths(supabase, paths);
  const urlByFileId = new Map(fileRows.map((row, index) => [row.id, signedUrls[index]]));

  const sourceFiles = fileRows
    .filter((row) => row.kind === "photo" || row.kind === "drawing" || row.kind === "document")
    .map((row) => mapSourceFileRow(row, urlByFileId.get(row.id) ?? null));

  const sourceViews = ((viewsResult.data ?? []) as SourceViewRow[]).map(mapSourceViewRow);

  const concepts: Concept[] = ((conceptsResult.data ?? []) as ConceptRow[]).map((row) => {
    const imageUrl = row.image_file_id ? urlByFileId.get(row.image_file_id) ?? null : null;
    return mapConceptRow(row, imageUrl);
  });

  const versions = ((versionsResult.data ?? []) as ConceptVersionRow[]).map(mapConceptVersionRow);
  const feedback: Feedback[] = ((feedbackResult.data ?? []) as ConceptFeedbackRow[]).map(mapFeedbackRow);
  const activity = ((activityResult.data ?? []) as ActivityEventRow[]).map(mapActivityEventRow);

  const project = mapProjectRow(projectRow);
  const cover = resolveProjectCover(concepts, sourceViews, sourceFiles);

  return {
    ...project,
    coverImage: cover.url ?? "",
    sourceFiles,
    sourceViews,
    concepts,
    versions,
    feedback,
    activity,
  };
}

/** Confirms the concept belongs to this project before writing — defense in depth on top of RLS + the foreign-key constraint. */
async function assertConceptBelongsToProject(supabase: SupabaseClient, projectId: string, conceptId: string): Promise<void> {
  const result = await supabase.from("concepts").select("id").eq("project_id", projectId).eq("id", conceptId).maybeSingle();
  failOnDatabaseError(result.error, "concept-lookup");
  if (!result.data) throw new ProjectRepositoryError("invalid-request", "concept-lookup");
}

export async function setSelectedConcept(supabase: SupabaseClient, projectId: string, conceptId: string | null): Promise<void> {
  if (conceptId !== null) await assertConceptBelongsToProject(supabase, projectId, conceptId);
  const result = await supabase.from("projects").update({ selected_concept_id: conceptId }).eq("id", projectId).select("id").maybeSingle();
  failOnDatabaseError(result.error, "select-concept");
  if (!result.data) throw new ProjectRepositoryError("not-found", "select-concept");
}

export async function addConceptFeedback(
  supabase: SupabaseClient,
  projectId: string,
  conceptId: string,
  comment: string,
  authorUserId: string,
  authorName: string,
): Promise<Feedback> {
  await assertConceptBelongsToProject(supabase, projectId, conceptId);
  const result = await supabase
    .from("concept_feedback")
    .insert({ project_id: projectId, concept_id: conceptId, author_user_id: authorUserId, author_name: authorName, comment })
    .select("id,concept_id,author_name,comment,created_at")
    .single();
  failOnDatabaseError(result.error, "feedback-insert");
  return mapFeedbackRow(result.data as ConceptFeedbackRow);
}

export async function getSignedFileUrl(supabase: SupabaseClient, projectId: string, fileId: string): Promise<string> {
  const result = await supabase.from("project_files").select("storage_path").eq("project_id", projectId).eq("id", fileId).maybeSingle();
  failOnDatabaseError(result.error, "file-lookup");
  const storagePath = (result.data as { storage_path: string | null } | null)?.storage_path;
  if (!result.data || !storagePath) throw new ProjectRepositoryError("not-found", "file-lookup");
  const url = await signPath(supabase, storagePath);
  if (!url) throw new ProjectRepositoryError("not-found", "file-sign");
  return url;
}

function failOnDatabaseError(error: { code?: string } | null, stage: string): void {
  if (!error) return;
  throw new ProjectRepositoryError("database-failed", stage);
}

export interface ClassifiedRepositoryError {
  code: "not-found" | "invalid-request" | "temporary-error";
  status: 404 | 400 | 503;
  message: string;
}

/**
 * Maps any error thrown by this module to a safe, generic response shape —
 * pure (no Next.js import) so it can be unit tested directly; the actual
 * NextResponse wrapping lives in project-route-helpers.ts, which every
 * /api/projects/* route calls. Never forwards a raw Postgres/Storage message.
 */
export function classifyRepositoryError(error: unknown): ClassifiedRepositoryError {
  const known = error instanceof ProjectRepositoryError ? error : null;
  if (known?.code === "not-found") return { code: "not-found", status: 404, message: "Проект не найден или недоступен." };
  if (known?.code === "invalid-request") return { code: "invalid-request", status: 400, message: "Некорректный запрос." };
  return { code: "temporary-error", status: 503, message: "Сервис временно недоступен. Повторите попытку позже." };
}
