import { base64ToBlob } from "./base64";
import type { GenerationMode } from "@/lib/types";
import type { GenerationStage } from "@/lib/generation-diagnostics";

export interface RawGenerationVariant {
  status: "succeeded" | "failed";
  mode: string;
  mimeType?: string;
  imageBase64?: string;
  warnings: string[];
  error?: { code: string; message: string };
}

export interface DecodedVariant {
  key: string;
  blob: Blob;
  mimeType: string;
  mode: GenerationMode;
  warnings: string[];
}

/** A failure at a specific stage of the paid-generation flow, with a message safe to show the user. */
export class GenerationFlowError extends Error {
  readonly stage: GenerationStage;
  readonly attemptId?: string;
  readonly projectId?: string;
  /**
   * True whenever a new paid attempt must not start until the user
   * explicitly acknowledges the risk — either because whether the previous
   * request reached the provider is genuinely unknown (network failure,
   * cancellation after dispatch, an unparseable response), or because it's
   * known to have completed and been billed but nothing could be recovered
   * from it (every returned image failed to decode). False only for
   * failures that happen before any request goes out (draft/attempt
   * persistence) or for a normal, well-understood server response
   * (validation, quota, safety rejection) that never leaves billing status
   * or outcome in doubt.
   */
  readonly requiresAcknowledgement: boolean;

  constructor(
    stage: GenerationStage,
    message: string,
    meta?: { attemptId?: string; projectId?: string; requiresAcknowledgement?: boolean },
  ) {
    super(message);
    this.stage = stage;
    this.attemptId = meta?.attemptId;
    this.projectId = meta?.projectId;
    this.requiresAcknowledgement = meta?.requiresAcknowledgement ?? false;
  }
}

export interface RequestAndDecodeDeps {
  generateAttemptId?: () => string;
  persistDraft: () => Promise<string>;
  persistAttempt: (projectId: string, attemptId: string) => Promise<void>;
  requestGeneration: (signal: AbortSignal) => Promise<Response>;
  onDiagnostic?: (attemptId: string, stage: GenerationStage, error: unknown) => void;
}

export interface RequestAndDecodeResult {
  attemptId: string;
  projectId: string;
  decoded: DecodedVariant[];
  /** True when fewer variants were usable than were requested (provider or decode failures on some, not all). */
  partial: boolean;
}

function defaultAttemptId(): string {
  return `attempt-${crypto.randomUUID()}`;
}

/**
 * Reuses a draft project already created earlier in the same wizard session
 * instead of creating another one on every retry. `createDraft` only runs
 * when no project exists yet.
 */
export async function reuseOrCreateDraft(existingProjectId: string | null, createDraft: () => Promise<string>): Promise<string> {
  if (existingProjectId) return existingProjectId;
  return createDraft();
}

export interface GenerationErrorRecovery {
  attemptId: string | null;
  projectId: string | null;
  requiresAcknowledgement: boolean;
  message: string;
}

/**
 * Pulls the wizard-recoverable state out of a caught error so a caller
 * never loses track of an already-created draft or attempt id — returns
 * null for anything that isn't a GenerationFlowError (nothing to recover).
 */
export function extractRecoveryState(error: unknown): GenerationErrorRecovery | null {
  if (!(error instanceof GenerationFlowError)) return null;
  return {
    attemptId: error.attemptId ?? null,
    projectId: error.projectId ?? null,
    requiresAcknowledgement: error.requiresAcknowledgement,
    message: error.message,
  };
}

/**
 * Runs the paid generation request end to end: persists the draft project
 * and an attempt record first (so both exist even if the provider call
 * never returns), sends the request, then decodes whatever succeeded.
 * Decoding failures are isolated per-variant so already-decoded Blobs are
 * never discarded because one image failed to decode.
 */
export async function requestAndDecodeConcepts(
  deps: RequestAndDecodeDeps,
  signal: AbortSignal,
): Promise<RequestAndDecodeResult> {
  const attemptId = (deps.generateAttemptId ?? defaultAttemptId)();
  const report = (stage: GenerationStage, error: unknown) => deps.onDiagnostic?.(attemptId, stage, error);

  let projectId: string;
  try {
    projectId = await deps.persistDraft();
  } catch (error) {
    report("persist-draft", error);
    throw new GenerationFlowError(
      "persist-draft",
      "Не удалось сохранить черновик проекта локально до запуска генерации. Платный запрос ещё не отправлялся — можно попробовать снова после устранения ошибки хранилища браузера.",
      { attemptId },
    );
  }

  try {
    await deps.persistAttempt(projectId, attemptId);
  } catch (error) {
    report("persist-attempt", error);
    throw new GenerationFlowError(
      "persist-attempt",
      "Не удалось зафиксировать запись о попытке генерации до отправки платного запроса. Провайдеру ничего не отправлено — можно попробовать снова после устранения ошибки хранилища браузера.",
      { attemptId, projectId },
    );
  }

  let response: Response;
  try {
    response = await deps.requestGeneration(signal);
  } catch (error) {
    report("request", error);
    if (error instanceof DOMException && error.name === "AbortError") {
      // Wrapped (never rethrown raw) so attemptId/projectId survive to the caller —
      // cancelling in the browser does not prove the provider never received/billed the request.
      throw new GenerationFlowError(
        "request",
        `Генерация была отменена в браузере после того, как запрос уже мог уйти на сервер (попытка ${attemptId}). Отмена не гарантирует, что платный запрос не был принят или оплачен провайдером. Прежде чем запускать новую генерацию, проверьте статус этой попытки.`,
        { attemptId, projectId, requiresAcknowledgement: true },
      );
    }
    throw new GenerationFlowError(
      "request",
      `Браузер не получил ответ от сервера генерации (попытка ${attemptId}). Это не значит, что платный запрос не дошёл до AI-провайдера — по одному сетевому сбою на клиенте это определить нельзя. Прежде чем запускать новую генерацию, проверьте статус этой попытки (например, по сохранённому черновику проекта) и подтвердите, что предыдущий запрос точно не был принят.`,
      { attemptId, projectId, requiresAcknowledgement: true },
    );
  }

  let payload: { variants?: RawGenerationVariant[]; error?: { message?: string } };
  try {
    payload = await response.json();
  } catch (error) {
    report("parse-response", error);
    throw new GenerationFlowError(
      "parse-response",
      "Сервер вернул ответ, который не удалось разобрать, хотя платный запрос к AI-провайдеру мог завершиться успешно. Прежде чем запускать генерацию снова, проверьте статус биллинга AI-провайдера, чтобы не оплатить его дважды.",
      { attemptId, projectId, requiresAcknowledgement: true },
    );
  }

  if (!response.ok) {
    const message = payload?.error?.message;
    throw new GenerationFlowError(
      "request",
      message
        ? `Сервер отклонил запрос генерации: ${message}`
        : "Сервер отклонил запрос генерации без пояснения.",
      { attemptId, projectId },
    );
  }

  const variants = payload.variants ?? [];
  const succeeded = variants.filter(
    (variant): variant is RawGenerationVariant & { imageBase64: string } =>
      variant.status === "succeeded" && !!variant.imageBase64,
  );

  if (succeeded.length === 0) {
    const firstError = variants.find((variant) => variant.error)?.error?.message;
    throw new GenerationFlowError(
      "request",
      firstError
        ? `AI-провайдер не создал ни одной пригодной концепции: ${firstError}`
        : "AI-провайдер не создал ни одной пригодной концепции.",
      { attemptId, projectId },
    );
  }

  const decoded: DecodedVariant[] = [];
  succeeded.forEach((variant, index) => {
    try {
      decoded.push({
        key: `${attemptId}-${index}`,
        blob: base64ToBlob(variant.imageBase64, variant.mimeType ?? "image/png"),
        mimeType: variant.mimeType ?? "image/png",
        mode: variant.mode as GenerationMode,
        warnings: variant.warnings,
      });
    } catch (error) {
      report("decode-image", error);
    }
  });

  if (decoded.length === 0) {
    throw new GenerationFlowError(
      "decode-image",
      "AI-провайдер вернул оплаченные изображения, но ни одно не удалось обработать в этом браузере. Не запускайте генерацию повторно — обновите страницу и, если ошибка повторится, обратитесь в поддержку с идентификатором попытки.",
      { attemptId, projectId, requiresAcknowledgement: true },
    );
  }

  return {
    attemptId,
    projectId,
    decoded,
    partial: decoded.length < variants.length,
  };
}
