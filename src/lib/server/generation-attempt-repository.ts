import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConceptSourceProvenance, GenerationMode, GeometryVerificationReport } from "@/lib/types";
import { conceptStateFromGeometryReview } from "../geometry-quality-gate";
import { signPath } from "./project-assets";

/**
 * Durable recoverable state machine for a cloud paid-generation attempt (see
 * Part 4 of the task brief). Backed entirely by the already-applied
 * `generation_attempts` table (supabase/migrations/202607200001_backend_foundation.sql)
 * — its `status` column has no CHECK constraint, so this module owns the
 * full vocabulary without a migration:
 *
 *   pre-dispatch        attempt identity persisted, provider not yet called
 *   dispatched          provider call in flight or its outcome is unknown
 *                        (network failure/timeout) — this is the "ambiguous,
 *                        may have been billed" terminal state; it is never
 *                        advanced automatically
 *   provider-completed  provider responded successfully (billed)
 *   persistence-partial  provider succeeded but Storage/DB persistence did not
 *                        fully complete — recoverable via retryImageBase64,
 *                        never by calling the provider again
 *   completed           image stored + concept row persisted
 *   failed              a well-understood, non-billing-ambiguous provider
 *                        rejection (validation, safety, quota, rate-limit) or
 *                        a billed-but-unusable response (malformed-response)
 *
 * Idempotency is enforced structurally, not just by status bookkeeping: both
 * the Storage object path and every row this module writes are keyed off the
 * client-supplied `attemptKey` (`project_files`/`concepts`/`concept_versions`/
 * `activity_events` all upsert on `(project_id, client_import_key)`), so
 * calling persistGeneratedConcept twice with the same attemptKey can never
 * create a duplicate concept or a duplicate Storage object.
 */

export type GenerationAttemptStatus = "pre-dispatch" | "dispatched" | "provider-completed" | "persistence-partial" | "completed" | "failed";
export type GenerationAttemptKind = "initial" | "correction" | "review";

export class GenerationAttemptRepositoryError extends Error {
  readonly code: "database-failed" | "storage-failed" | "conflict";
  readonly stage: string;

  constructor(code: GenerationAttemptRepositoryError["code"], stage: string) {
    super(code);
    this.name = "GenerationAttemptRepositoryError";
    this.code = code;
    this.stage = stage;
  }
}

export interface GenerationAttemptRow {
  id: string;
  attemptKey: string;
  projectId: string;
  status: GenerationAttemptStatus;
  errorCode: string | null;
  /** Raw jsonb — a ConceptSourceProvenance while pre-dispatch/dispatched, or a GenerationPersistPayload envelope once provider-completed (see markAttemptProviderCompleted). */
  sourceProvenance: unknown;
}

function fail(error: { message?: string; code?: string } | null, stage: string): void {
  if (!error) return;
  throw new GenerationAttemptRepositoryError("database-failed", stage);
}

export async function findGenerationAttempt(supabase: SupabaseClient, attemptKey: string): Promise<GenerationAttemptRow | null> {
  const result = await supabase
    .from("generation_attempts")
    .select("id,attempt_key,project_id,status,error_code,source_provenance")
    .eq("attempt_key", attemptKey)
    .maybeSingle();
  fail(result.error, "attempt-lookup");
  if (!result.data) return null;
  const row = result.data as { id: string; attempt_key: string; project_id: string; status: string; error_code: string | null; source_provenance: unknown };
  return {
    id: row.id,
    attemptKey: row.attempt_key,
    projectId: row.project_id,
    status: row.status as GenerationAttemptStatus,
    errorCode: row.error_code,
    sourceProvenance: row.source_provenance,
  };
}

export async function createPreDispatchAttempt(
  supabase: SupabaseClient,
  input: {
    attemptKey: string;
    projectId: string;
    userId: string;
    kind: GenerationAttemptKind;
    sourceConceptId?: string;
    sourceProvenance?: ConceptSourceProvenance;
  },
): Promise<void> {
  const result = await supabase.from("generation_attempts").insert({
    attempt_key: input.attemptKey,
    project_id: input.projectId,
    user_id: input.userId,
    kind: input.kind,
    source_concept_id: input.sourceConceptId ?? null,
    status: "pre-dispatch",
    source_provenance: input.sourceProvenance ?? null,
  });
  // 23505 = unique_violation on attempt_key — a concurrent/duplicate insert
  // for the same idempotency key is not an error, the row already exists.
  if (result.error && result.error.code !== "23505") throw new GenerationAttemptRepositoryError("database-failed", "attempt-insert");
}

export async function markAttemptStatus(
  supabase: SupabaseClient,
  attemptKey: string,
  status: GenerationAttemptStatus,
  errorCode?: string,
): Promise<void> {
  const terminal = status === "completed" || status === "failed";
  const result = await supabase
    .from("generation_attempts")
    .update({ status, error_code: errorCode ?? null, ...(terminal ? { completed_at: new Date().toISOString() } : {}) })
    .eq("attempt_key", attemptKey);
  fail(result.error, "attempt-status-update");
}

/**
 * Everything besides the image bytes needed to persist a concept — written
 * into the attempt's `source_provenance` column the moment the provider
 * responds successfully (see markAttemptProviderCompleted). A later
 * retry-persistence request (see /api/projects/:id/concepts/generate) reads
 * it back with getAttemptPersistPayload, so the client only ever needs to
 * resend the image bytes it already holds — never the concept metadata,
 * and never anything that would let it forge a different outcome.
 */
export interface GenerationPersistPayload {
  label: string;
  summary: string;
  changeExplanation: string;
  mode: GenerationMode;
  warnings: string[];
  sourceProvenance: ConceptSourceProvenance;
  geometryVerification?: GeometryVerificationReport;
  parentConceptId?: string;
}

export async function markAttemptProviderCompleted(
  supabase: SupabaseClient,
  attemptKey: string,
  payload: GenerationPersistPayload,
): Promise<void> {
  const result = await supabase
    .from("generation_attempts")
    .update({ status: "provider-completed", source_provenance: payload })
    .eq("attempt_key", attemptKey);
  fail(result.error, "attempt-provider-completed");
}

/** Validates the jsonb envelope written by markAttemptProviderCompleted — defensive against a row from an unexpected earlier stage. */
export function parseGenerationPersistPayload(value: unknown): GenerationPersistPayload | null {
  if (!isRecord(value)) return null;
  if (typeof value.label !== "string" || typeof value.summary !== "string" || typeof value.changeExplanation !== "string") return null;
  if (typeof value.mode !== "string" || !Array.isArray(value.warnings)) return null;
  if (!isRecord(value.sourceProvenance) || typeof value.sourceProvenance.sourceFileId !== "string") return null;
  return value as unknown as GenerationPersistPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export interface PersistGeneratedConceptInput extends GenerationPersistPayload {
  attemptKey: string;
  workspaceId: string;
  projectId: string;
  userId: string;
  imageBytes: Buffer;
  mimeType: string;
}

export interface PersistedConcept {
  conceptId: string;
  imageUrl: string | null;
}

/**
 * Uploads the generated image to a path deterministic in `attemptKey` and
 * upserts every dependent row keyed the same way. Safe to call twice with
 * identical inputs (retry-persistence path) — never re-dispatches to the
 * provider, since it takes already-decoded bytes, not a request to send.
 */
export async function persistGeneratedConcept(supabase: SupabaseClient, input: PersistGeneratedConceptInput): Promise<PersistedConcept> {
  const storagePath = `${input.workspaceId}/${input.projectId}/generation-attempts/${input.attemptKey}.${extensionForMime(input.mimeType)}`;

  const uploadResult = await supabase.storage
    .from("project-assets")
    .upload(storagePath, input.imageBytes, { contentType: input.mimeType, upsert: true });
  if (uploadResult.error) {
    await markAttemptStatus(supabase, input.attemptKey, "persistence-partial", "storage-upload-failed");
    throw new GenerationAttemptRepositoryError("storage-failed", "upload");
  }

  try {
    const fileResult = await supabase
      .from("project_files")
      .upsert(
        {
          project_id: input.projectId,
          client_import_key: input.attemptKey,
          created_by: input.userId,
          kind: "concept",
          name: `${input.label}.${extensionForMime(input.mimeType)}`,
          mime_type: input.mimeType,
          size_bytes: input.imageBytes.length,
          storage_path: storagePath,
          metadata: { mode: input.mode, warnings: input.warnings },
        },
        { onConflict: "project_id,client_import_key" },
      )
      .select("id")
      .single();
    if (fileResult.error) throw new GenerationAttemptRepositoryError("database-failed", "project-files-upsert");
    const imageFileId = String((fileResult.data as { id: string }).id);

    const conceptState = conceptStateFromGeometryReview(input.geometryVerification);
    const conceptResult = await supabase
      .from("concepts")
      .upsert(
        {
          project_id: input.projectId,
          client_import_key: input.attemptKey,
          parent_concept_id: input.parentConceptId ?? null,
          created_by: input.userId,
          image_file_id: imageFileId,
          label: input.label,
          state: conceptState,
          summary: input.summary,
          change_explanation: input.changeExplanation,
          generation_mode: input.mode,
          warnings: input.warnings,
          source_provenance: input.sourceProvenance,
          geometry_verification: input.geometryVerification ?? null,
        },
        { onConflict: "project_id,client_import_key" },
      )
      .select("id")
      .single();
    if (conceptResult.error) throw new GenerationAttemptRepositoryError("database-failed", "concepts-upsert");
    const conceptId = String((conceptResult.data as { id: string }).id);

    if (input.parentConceptId) {
      const versionResult = await supabase.from("concept_versions").upsert(
        {
          project_id: input.projectId,
          client_import_key: `${input.attemptKey}-version`,
          concept_id: conceptId,
          label: "Исправленная версия",
          change_summary: input.changeExplanation,
        },
        { onConflict: "project_id,client_import_key" },
      );
      if (versionResult.error) throw new GenerationAttemptRepositoryError("database-failed", "concept-versions-upsert");
    }

    const activityResult = await supabase.from("activity_events").upsert(
      {
        project_id: input.projectId,
        client_import_key: `${input.attemptKey}-activity`,
        actor_user_id: null,
        actor_type: "agent",
        action: input.parentConceptId ? `Создана исправленная версия «${input.label}»` : `Сгенерирована концепция «${input.label}»`,
        metadata: { actorName: "AI Architect" },
      },
      { onConflict: "project_id,client_import_key" },
    );
    if (activityResult.error) throw new GenerationAttemptRepositoryError("database-failed", "activity-insert");

    const projectUpdateResult = await supabase
      .from("projects")
      .update({ lifecycle_stage: "concept", state: conceptState })
      .eq("id", input.projectId);
    if (projectUpdateResult.error) throw new GenerationAttemptRepositoryError("database-failed", "project-state-update");

    await markAttemptStatus(supabase, input.attemptKey, "completed");
    const imageUrl = await signPath(supabase, storagePath);
    return { conceptId, imageUrl };
  } catch (error) {
    await markAttemptStatus(supabase, input.attemptKey, "persistence-partial", "database-write-failed");
    throw error instanceof GenerationAttemptRepositoryError ? error : new GenerationAttemptRepositoryError("database-failed", "persist");
  }
}

/** Idempotent-read counterpart: resolves an already-completed attempt back to its concept, without touching the provider or Storage write path. */
export async function findPersistedConceptByAttempt(
  supabase: SupabaseClient,
  projectId: string,
  attemptKey: string,
): Promise<PersistedConcept | null> {
  const conceptResult = await supabase
    .from("concepts")
    .select("id,image_file_id")
    .eq("project_id", projectId)
    .eq("client_import_key", attemptKey)
    .maybeSingle();
  fail(conceptResult.error, "concept-lookup");
  if (!conceptResult.data) return null;
  const row = conceptResult.data as { id: string; image_file_id: string | null };

  let imageUrl: string | null = null;
  if (row.image_file_id) {
    const fileResult = await supabase.from("project_files").select("storage_path").eq("id", row.image_file_id).maybeSingle();
    fail(fileResult.error, "concept-file-lookup");
    const storagePath = (fileResult.data as { storage_path: string | null } | null)?.storage_path;
    imageUrl = await signPath(supabase, storagePath);
  }

  return { conceptId: String(row.id), imageUrl };
}

export async function getWorkspaceIdForProject(supabase: SupabaseClient, projectId: string): Promise<string> {
  const result = await supabase.from("projects").select("workspace_id").eq("id", projectId).maybeSingle();
  fail(result.error, "workspace-lookup");
  const row = result.data as { workspace_id: string } | null;
  if (!row) throw new GenerationAttemptRepositoryError("database-failed", "workspace-lookup");
  return String(row.workspace_id);
}
