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

  constructor(stage: GenerationStage, message: string, meta?: { attemptId?: string; projectId?: string }) {
    super(message);
    this.stage = stage;
    this.attemptId = meta?.attemptId;
    this.projectId = meta?.projectId;
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
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    report("request", error);
    throw new GenerationFlowError(
      "request",
      "Не удалось отправить запрос на сервер генерации. Платный запрос к AI-провайдеру не был отправлен, подключение к интернету можно проверить и запустить генерацию снова.",
      { attemptId, projectId },
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
      { attemptId, projectId },
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
      { attemptId, projectId },
    );
  }

  return {
    attemptId,
    projectId,
    decoded,
    partial: decoded.length < variants.length,
  };
}
