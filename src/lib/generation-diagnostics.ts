/**
 * Client-side diagnostics for the paid concept-generation flow.
 *
 * Errors here can originate from IndexedDB, `fetch`, or a provider response
 * that may embed request details. Never forward the raw Error object or its
 * `.message` to the console — log only the attempt id, the stage that
 * failed, and a safe classification of the error (its `name`/constructor),
 * so diagnostics can be correlated without ever leaking provider or
 * environment detail.
 */

export type GenerationStage =
  | "persist-draft"
  | "persist-attempt"
  | "request"
  | "parse-response"
  | "decode-image"
  | "persist-concept"
  | "unknown";

export interface SafeDiagnostic {
  attemptId: string;
  stage: GenerationStage;
  code: string;
}

/** Classifies an unknown error into a safe, message-free code. */
export function safeErrorCode(error: unknown): string {
  if (error instanceof DOMException) return error.name || "DOMException";
  if (error instanceof Error) return error.name || error.constructor.name || "Error";
  if (error === null || error === undefined) return "UnknownError";
  return `Unknown:${typeof error}`;
}

/** Logs a stage failure with no raw error message or object — see module doc. */
export function logGenerationDiagnostic(attemptId: string, stage: GenerationStage, error: unknown): SafeDiagnostic {
  const diagnostic: SafeDiagnostic = { attemptId, stage, code: safeErrorCode(error) };
  console.error("[concepts:generate]", diagnostic);
  return diagnostic;
}
