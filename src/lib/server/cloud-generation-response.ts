import { NextResponse } from "next/server";
import {
  GenerationAttemptRepositoryError,
  persistGeneratedConcept,
  type PersistGeneratedConceptInput,
} from "./generation-attempt-repository";
import { CloudGenerationSourceError } from "./cloud-generation-source";
import { errorResponse } from "./project-route-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared response shaping for both cloud generation routes (Part 2 generate,
 * Part 3 correct) — persists via generation-attempt-repository.ts and turns
 * the outcome into the JSON contract the workspace UI understands. Kept
 * separate from the route handlers so both share identical recovery
 * semantics instead of drifting.
 */
export async function persistAndRespond(supabase: SupabaseClient, input: PersistGeneratedConceptInput): Promise<NextResponse> {
  try {
    const persisted = await persistGeneratedConcept(supabase, input);
    return NextResponse.json({ status: "succeeded", attemptKey: input.attemptKey, concept: persisted });
  } catch (error) {
    const known = error instanceof GenerationAttemptRepositoryError ? error : null;
    console.warn("[cloud-concepts:persist]", { stage: known?.stage ?? "unknown", code: known?.code ?? "UnknownError" });
    return NextResponse.json(
      {
        status: "persistence-failed",
        attemptKey: input.attemptKey,
        imageBase64: input.imageBytes.toString("base64"),
        mimeType: input.mimeType,
        error: {
          code: "persistence-failed",
          message:
            "Платный результат получен и повторно запрашиваться не будет, но сохранить его в облаке пока не удалось. Повторите только сохранение — это не отправляет новый запрос к AI-провайдеру.",
        },
      },
      { status: 502 },
    );
  }
}

export function cloudSourceErrorResponse(error: unknown) {
  if (error instanceof CloudGenerationSourceError) {
    if (error.code === "not-found") return errorResponse("not-found", "Проект не найден или недоступен.", 404);
    if (error.code === "no-primary-view") {
      return errorResponse(
        "no-primary-view",
        "У проекта нет подтверждённого основного ракурса. Подтвердите Primary View в материалах проекта перед генерацией.",
        400,
      );
    }
    console.warn("[cloud-concepts:source]", { stage: error.stage, code: error.code });
    return errorResponse("temporary-error", "Не удалось загрузить исходные материалы проекта. Повторите попытку позже.", 503);
  }
  console.error("[cloud-concepts:source]", { code: "UnknownError" });
  return errorResponse("temporary-error", "Сервис временно недоступен. Повторите попытку позже.", 503);
}
