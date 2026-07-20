import { NextRequest, NextResponse } from "next/server";
import { isServerProjectId } from "@/lib/project-id";
import { buildCorrectionPrompt } from "@/lib/ai/correction-prompt";
import { canCreateCorrectedVersion, correctionFindings } from "@/lib/concept-correction";
import { runCloudGenerationVariant } from "@/lib/server/cloud-generation-runner";
import { cloudSourceErrorResponse, persistAndRespond } from "@/lib/server/cloud-generation-response";
import { parseCloudCorrectBody } from "@/lib/server/cloud-generation-request";
import { CloudGenerationSourceError, loadProjectBrief, loadProvenanceSourceImage } from "@/lib/server/cloud-generation-source";
import {
  createPreDispatchAttempt,
  findGenerationAttempt,
  findPersistedConceptByAttempt,
  getWorkspaceIdForProject,
  markAttemptProviderCompleted,
  markAttemptStatus,
  parseGenerationPersistPayload,
} from "@/lib/server/generation-attempt-repository";
import { mapConceptRow, type ConceptRow } from "@/lib/server/project-row-mapping";
import { errorResponse, failureResponse, resolveProjectRouteContext } from "@/lib/server/project-route-helpers";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function loadConceptForCorrection(supabase: SupabaseClient, projectId: string, conceptId: string) {
  const result = await supabase
    .from("concepts")
    .select("id,parent_concept_id,image_file_id,label,state,summary,change_explanation,generation_mode,warnings,source_provenance,geometry_verification,created_at")
    .eq("project_id", projectId)
    .eq("id", conceptId)
    .maybeSingle();
  if (result.error) throw new CloudGenerationSourceError("database-failed", "concept-lookup");
  if (!result.data) throw new CloudGenerationSourceError("not-found", "concept-lookup");
  const row = result.data as ConceptRow;
  return { row, concept: mapConceptRow(row, null) };
}

async function loadTargetImage(supabase: SupabaseClient, projectId: string, imageFileId: string) {
  const result = await supabase.from("project_files").select("mime_type,storage_path").eq("project_id", projectId).eq("id", imageFileId).maybeSingle();
  if (result.error) throw new CloudGenerationSourceError("database-failed", "concept-image-lookup");
  const file = result.data as { mime_type: string | null; storage_path: string | null } | null;
  if (!file?.storage_path) throw new CloudGenerationSourceError("storage-failed", "concept-image-missing");
  const download = await supabase.storage.from("project-assets").download(file.storage_path);
  if (download.error || !download.data) throw new CloudGenerationSourceError("storage-failed", "concept-image-download");
  const bytes = Buffer.from(await download.data.arrayBuffer());
  return { bytes, mimeType: file.mime_type || "image/png" };
}

/**
 * Paid correction for an existing cloud concept — see specs, Part 3. Mirrors
 * POST /api/concepts/correct's contract and Phase 6 rules (parentConceptId,
 * a new concept_versions entry, Reviewer always runs) but persists into
 * Supabase instead of IndexedDB, and reuses the Part 4 recoverable state
 * machine from generation-attempt-repository.ts.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string; conceptId: string }> }) {
  const context = await resolveProjectRouteContext(request);
  if (!context.ok) return failureResponse(context);

  const { projectId, conceptId } = await params;
  if (!isServerProjectId(projectId) || !isServerProjectId(conceptId)) return errorResponse("not-found", "Проект не найден или недоступен.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid-request", "Некорректный запрос.", 400);
  }
  const parsed = parseCloudCorrectBody(body);
  if (!parsed) return errorResponse("invalid-request", "Некорректный запрос.", 400);

  const supabase = await createClient();

  try {
    const existing = await findGenerationAttempt(supabase, parsed.attemptKey);
    if (existing && existing.projectId !== projectId) {
      return errorResponse("invalid-request", "Идентификатор попытки уже используется другим проектом.", 400);
    }

    if (existing?.status === "completed") {
      const persisted = await findPersistedConceptByAttempt(supabase, projectId, parsed.attemptKey);
      return NextResponse.json({ status: "succeeded", attemptKey: parsed.attemptKey, concept: persisted, resumed: true });
    }

    if (existing?.status === "provider-completed" || existing?.status === "persistence-partial") {
      if (!parsed.retryImageBase64 || !parsed.retryMimeType) {
        return errorResponse(
          "retry-requires-bytes",
          "Для повтора сохранения нужно отправить уже полученное изображение, сохранённое в этой вкладке браузера.",
          409,
        );
      }
      const payload = parseGenerationPersistPayload(existing.sourceProvenance);
      if (!payload) {
        return errorResponse("temporary-error", "Не удалось восстановить данные предыдущей попытки. Начните новое исправление.", 503);
      }
      const workspaceId = await getWorkspaceIdForProject(supabase, projectId);
      return await persistAndRespond(supabase, {
        ...payload,
        attemptKey: parsed.attemptKey,
        workspaceId,
        projectId,
        userId: context.userId,
        imageBytes: Buffer.from(parsed.retryImageBase64, "base64"),
        mimeType: parsed.retryMimeType,
      });
    }

    if (existing?.status === "dispatched") {
      return errorResponse(
        "ambiguous-attempt",
        "Результат предыдущей попытки исправления неизвестен — она могла быть оплачена. Подтвердите риск повторной оплаты и начните новую попытку.",
        409,
      );
    }

    let concept, row, targetImage, workspaceId, brief;
    try {
      ({ row, concept } = await loadConceptForCorrection(supabase, projectId, conceptId));
      if (!canCreateCorrectedVersion(concept)) {
        return errorResponse(
          "not-correctable",
          "Для этой концепции нет конкретных замечаний Quality Gate или исходных данных для исправления.",
          400,
        );
      }
      if (!row.image_file_id) throw new CloudGenerationSourceError("storage-failed", "concept-image-missing");
      targetImage = await loadTargetImage(supabase, projectId, row.image_file_id);
      ({ workspaceId, brief } = await loadProjectBrief(supabase, projectId));
    } catch (error) {
      return cloudSourceErrorResponse(error);
    }

    const provenance = concept.sourceProvenance!;
    const findings = correctionFindings(concept);
    const primaryImage = await loadProvenanceSourceImage(supabase, projectId, provenance, "primary");
    const referenceProvenance = provenance.referenceViews?.[0];
    const referenceImage = referenceProvenance ? await loadProvenanceSourceImage(supabase, projectId, referenceProvenance, "reference") : null;

    const images = [
      { data: targetImage.bytes, mimeType: targetImage.mimeType, role: "other" as const, purpose: "correction-target" as const },
      primaryImage,
      ...(referenceImage ? [referenceImage] : []),
    ];
    const imageLabels = [
      "IMAGE 1: GENERATED CONCEPT TO CORRECT — edit this image and preserve its design intent.",
      "IMAGE 2: ORIGINAL PRIMARY VIEW — authoritative geometry and camera reference.",
      ...(referenceImage ? ["IMAGE 3: ORIGINAL REFERENCE VIEW — geometry context only, not the output camera."] : []),
    ];

    if (!existing) {
      await createPreDispatchAttempt(supabase, {
        attemptKey: parsed.attemptKey,
        projectId,
        userId: context.userId,
        kind: "correction",
        sourceConceptId: conceptId,
        sourceProvenance: provenance,
      });
    }
    await markAttemptStatus(supabase, parsed.attemptKey, "dispatched");

    const constraints = { goal: brief.goal, explicitChanges: concept.changeExplanation, mustKeep: brief.mustKeep, mayChange: brief.mayChange };
    const variant = await runCloudGenerationVariant({
      mode: parsed.mode,
      images,
      constraints,
      autoReview: true,
      promptOverride: buildCorrectionPrompt(constraints, findings, Boolean(referenceImage)),
      imageLabels,
      reviewerPrimaryImage: primaryImage,
      reviewerReferenceImages: referenceImage ? [referenceImage] : [],
    });

    if (variant.status === "failed") {
      const ambiguous = variant.error.code === "provider-timeout" || variant.error.code === "provider-failure";
      const billedButUnusable = variant.error.code === "malformed-response";
      if (!ambiguous) await markAttemptStatus(supabase, parsed.attemptKey, "failed", variant.error.code);
      return NextResponse.json(
        { status: "failed", attemptKey: parsed.attemptKey, requiresAcknowledgement: ambiguous || billedButUnusable, error: variant.error },
        { status: ambiguous ? 502 : 422 },
      );
    }

    const persistPayload = {
      label: `${concept.label} · исправленная версия`,
      summary: "Исправленная версия по замечаниям Quality Gate",
      changeExplanation: `Исправлены замечания: ${findings.join("; ")}`,
      mode: variant.effectiveMode,
      warnings: variant.warnings,
      sourceProvenance: provenance,
      geometryVerification: variant.geometryVerification,
      parentConceptId: conceptId,
    };
    await markAttemptProviderCompleted(supabase, parsed.attemptKey, persistPayload);

    return await persistAndRespond(supabase, {
      ...persistPayload,
      attemptKey: parsed.attemptKey,
      workspaceId,
      projectId,
      userId: context.userId,
      imageBytes: Buffer.from(variant.imageBase64, "base64"),
      mimeType: variant.mimeType,
    });
  } catch {
    return errorResponse("temporary-error", "Сервис временно недоступен. Повторите попытку позже.", 503);
  }
}
