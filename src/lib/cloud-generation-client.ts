import type { GenerationMode } from "./types";

/**
 * Browser-side fetch wrappers for the two cloud paid-generation routes (see
 * specs Parts 2/3/4): POST /api/projects/:id/concepts/generate and
 * POST /api/projects/:id/concepts/:conceptId/correct. Mirrors the safe
 * error-mapping shape already used by server-project-client.ts, but the
 * response contract here also carries the Part 4 recoverable-attempt states
 * (succeeded / failed / persistence-failed), not just success-or-error.
 */

export interface CloudConceptResult {
  conceptId: string;
  imageUrl: string | null;
}

export interface CloudGenerationSucceeded {
  status: "succeeded";
  attemptKey: string;
  concept: CloudConceptResult | null;
  resumed?: boolean;
}

export interface CloudGenerationFailed {
  status: "failed";
  attemptKey: string;
  requiresAcknowledgement: boolean;
  error: { code: string; message: string };
}

export interface CloudGenerationPersistenceFailed {
  status: "persistence-failed";
  attemptKey: string;
  imageBase64: string;
  mimeType: string;
  error: { code: string; message: string };
}

export type CloudGenerationResponse = CloudGenerationSucceeded | CloudGenerationFailed | CloudGenerationPersistenceFailed;

/** Codes for which whether the request was billed is genuinely unknown — the caller must require explicit user acknowledgement before starting a new attempt with a fresh attemptKey. */
const AMBIGUOUS_CLIENT_ERROR_CODES = new Set(["network-error", "parse-error", "ambiguous-attempt", "retry-requires-bytes"]);

export class CloudGenerationRequestError extends Error {
  readonly code: string;
  readonly requiresAcknowledgement: boolean;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CloudGenerationRequestError";
    this.code = code;
    this.requiresAcknowledgement = AMBIGUOUS_CLIENT_ERROR_CODES.has(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function postJson(url: string, body: unknown): Promise<CloudGenerationResponse> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new CloudGenerationRequestError(
      "network-error",
      "Браузер не получил ответ от сервера. Это не означает, что платный запрос не был отправлен — прежде чем начинать новую генерацию, подтвердите риск повторной оплаты.",
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new CloudGenerationRequestError(
      "parse-error",
      "Сервер вернул ответ, который не удалось разобрать, хотя платный запрос мог завершиться успешно. Подтвердите риск повторной оплаты, прежде чем начинать новую генерацию.",
    );
  }

  if (isRecord(json) && typeof json.status === "string") {
    return json as unknown as CloudGenerationResponse;
  }
  const errorBody = isRecord(json) && isRecord(json.error) ? json.error : null;
  const code = typeof errorBody?.code === "string" ? errorBody.code : "unknown";
  const message = typeof errorBody?.message === "string" ? errorBody.message : "Сервис временно недоступен. Повторите попытку позже.";
  throw new CloudGenerationRequestError(code, message);
}

export function requestCloudGeneration(
  projectId: string,
  body: { attemptKey: string; mode: GenerationMode; autoReview: boolean; retryImageBase64?: string; retryMimeType?: string },
): Promise<CloudGenerationResponse> {
  return postJson(`/api/projects/${projectId}/concepts/generate`, body);
}

export function requestCloudCorrection(
  projectId: string,
  conceptId: string,
  body: { attemptKey: string; mode: GenerationMode; retryImageBase64?: string; retryMimeType?: string },
): Promise<CloudGenerationResponse> {
  return postJson(`/api/projects/${projectId}/concepts/${conceptId}/correct`, body);
}
