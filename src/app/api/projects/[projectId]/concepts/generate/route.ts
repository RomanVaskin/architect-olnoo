import { NextRequest, NextResponse } from "next/server";
import { isServerProjectId } from "@/lib/project-id";
import {
  AMBIGUOUS_GENERATION_ERROR_CODES,
  BILLED_BUT_UNUSABLE_ERROR_CODES,
  runCloudGenerationVariant,
} from "@/lib/server/cloud-generation-runner";
import { cloudSourceErrorResponse, persistAndRespond } from "@/lib/server/cloud-generation-response";
import { parseCloudGenerateBody } from "@/lib/server/cloud-generation-request";
import { loadCloudGenerationSource } from "@/lib/server/cloud-generation-source";
import {
  createPreDispatchAttempt,
  findGenerationAttempt,
  findPersistedConceptByAttempt,
  getWorkspaceIdForProject,
  markAttemptProviderCompleted,
  markAttemptStatus,
  parseGenerationPersistPayload,
} from "@/lib/server/generation-attempt-repository";
import { errorResponse, failureResponse, resolveProjectRouteContext } from "@/lib/server/project-route-helpers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Paid concept generation for a Supabase (cloud) project — see specs, Part 2.
 * Unlike POST /api/concepts/generate (local `local-*` projects, unchanged),
 * the client never supplies images or brief text here: everything comes
 * from the project's own stored source files/confirmed source views and
 * brief, loaded server-side under the caller's RLS session, so a request
 * body cannot choose arbitrary Storage paths or another project's data.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const context = await resolveProjectRouteContext(request);
  if (!context.ok) return failureResponse(context);

  const { projectId } = await params;
  if (!isServerProjectId(projectId)) return errorResponse("not-found", "Проект не найден или недоступен.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid-request", "Некорректный запрос.", 400);
  }
  const parsed = parseCloudGenerateBody(body);
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
        return errorResponse("temporary-error", "Не удалось восстановить данные предыдущей попытки. Начните новую генерацию.", 503);
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
        "Результат предыдущей попытки неизвестен — она могла быть оплачена. Подтвердите риск повторной оплаты и начните новую попытку.",
        409,
      );
    }

    // existing is null (brand new) or "pre-dispatch" (provider was never reached) — safe to (re)dispatch.
    let source;
    try {
      source = await loadCloudGenerationSource(supabase, projectId);
    } catch (error) {
      return cloudSourceErrorResponse(error);
    }

    if (!existing) {
      await createPreDispatchAttempt(supabase, {
        attemptKey: parsed.attemptKey,
        projectId,
        userId: context.userId,
        kind: "initial",
        sourceProvenance: source.sourceProvenance,
      });
    }
    await markAttemptStatus(supabase, parsed.attemptKey, "dispatched");

    const explicitChanges = source.brief.wantsChanged.join("; ");
    const variant = await runCloudGenerationVariant({
      mode: parsed.mode,
      images: source.images,
      constraints: {
        goal: source.brief.goal,
        explicitChanges,
        mustKeep: source.brief.mustKeep,
        mayChange: source.brief.mayChange,
      },
      autoReview: parsed.autoReview,
    });

    if (variant.status === "failed") {
      const ambiguous = AMBIGUOUS_GENERATION_ERROR_CODES.has(variant.error.code);
      const billedButUnusable = BILLED_BUT_UNUSABLE_ERROR_CODES.has(variant.error.code);
      if (!ambiguous) await markAttemptStatus(supabase, parsed.attemptKey, "failed", variant.error.code);
      return NextResponse.json(
        {
          status: "failed",
          attemptKey: parsed.attemptKey,
          requiresAcknowledgement: ambiguous || billedButUnusable,
          error: variant.error,
        },
        { status: ambiguous ? 502 : 422 },
      );
    }

    const persistPayload = {
      label: "Концепция",
      summary: source.brief.goal,
      changeExplanation: explicitChanges || source.brief.goal,
      mode: variant.effectiveMode,
      warnings: variant.warnings,
      sourceProvenance: source.sourceProvenance,
      geometryVerification: variant.geometryVerification,
    };
    await markAttemptProviderCompleted(supabase, parsed.attemptKey, persistPayload);

    return await persistAndRespond(supabase, {
      ...persistPayload,
      attemptKey: parsed.attemptKey,
      workspaceId: source.workspaceId,
      projectId,
      userId: context.userId,
      imageBytes: Buffer.from(variant.imageBase64, "base64"),
      mimeType: variant.mimeType,
    });
  } catch {
    return errorResponse("temporary-error", "Сервис временно недоступен. Повторите попытку позже.", 503);
  }
}
