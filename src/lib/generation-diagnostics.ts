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
  | "persist-concept-image"
  | "persist-concept-metadata"
  | "unknown";

export interface SafeDiagnostic {
  attemptId: string;
  stage: GenerationStage;
  code: string;
}

/**
 * Stages that fail because of local IndexedDB persistence rather than the
 * network or the AI provider. These are already handled (the user sees a
 * clear recovery message), so they log with `console.warn` — `console.error`
 * would trigger Next.js's dev error overlay for a failure that isn't fatal.
 */
const PERSISTENCE_STAGES = new Set<GenerationStage>([
  "persist-draft",
  "persist-attempt",
  "persist-concept",
  "persist-concept-image",
  "persist-concept-metadata",
]);

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
  const log = PERSISTENCE_STAGES.has(stage) ? console.warn : console.error;
  log("[concepts:generate]", diagnostic);
  return diagnostic;
}

/**
 * Thrown by concept persistence to distinguish an image-store failure from
 * a project-metadata-store failure, so diagnostics don't collapse both into
 * one undifferentiated "persist-concept" stage.
 */
export class ConceptPersistError extends Error {
  readonly stage: "persist-concept-image" | "persist-concept-metadata";

  constructor(stage: "persist-concept-image" | "persist-concept-metadata") {
    super(`Concept persistence failed at stage: ${stage}`);
    this.name = "ConceptPersistError";
    this.stage = stage;
  }
}
