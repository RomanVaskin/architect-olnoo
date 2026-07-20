import { isServerProjectId } from "../project-id";
import type { GenerationMode } from "@/lib/types";

/**
 * Pure request-body validation shared by both cloud generation routes (Part
 * 2 generate, Part 3 correct). Kept out of the route handlers so it can be
 * unit tested directly, mirroring src/lib/ai/request-validation.ts for the
 * local routes. `attemptKey` is validated as a UUID because it is used
 * directly as a Storage path segment (see generation-attempt-repository.ts)
 * — an unvalidated value here would be a path-injection risk.
 */

const GENERATION_MODES: GenerationMode[] = ["auto", "fast", "balanced", "maximum-quality"];
const ACCEPTED_RETRY_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface CloudGenerateBody {
  attemptKey: string;
  mode: GenerationMode;
  autoReview: boolean;
  retryImageBase64?: string;
  retryMimeType?: string;
}

export interface CloudCorrectBody {
  attemptKey: string;
  mode: GenerationMode;
  retryImageBase64?: string;
  retryMimeType?: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validRetryFields(value: Record<string, unknown>): boolean {
  if (value.retryImageBase64 !== undefined && typeof value.retryImageBase64 !== "string") return false;
  if (value.retryMimeType !== undefined && (typeof value.retryMimeType !== "string" || !ACCEPTED_RETRY_MIME_TYPES.has(value.retryMimeType))) {
    return false;
  }
  return true;
}

export function parseCloudGenerateBody(value: unknown): CloudGenerateBody | null {
  if (!isRecord(value)) return null;
  if (typeof value.attemptKey !== "string" || !isServerProjectId(value.attemptKey)) return null;
  if (typeof value.mode !== "string" || !GENERATION_MODES.includes(value.mode as GenerationMode)) return null;
  if (typeof value.autoReview !== "boolean") return null;
  if (!validRetryFields(value)) return null;
  return {
    attemptKey: value.attemptKey,
    mode: value.mode as GenerationMode,
    autoReview: value.autoReview,
    retryImageBase64: value.retryImageBase64 as string | undefined,
    retryMimeType: value.retryMimeType as string | undefined,
  };
}

export function parseCloudCorrectBody(value: unknown): CloudCorrectBody | null {
  if (!isRecord(value)) return null;
  if (typeof value.attemptKey !== "string" || !isServerProjectId(value.attemptKey)) return null;
  if (typeof value.mode !== "string" || !GENERATION_MODES.includes(value.mode as GenerationMode)) return null;
  if (!validRetryFields(value)) return null;
  return {
    attemptKey: value.attemptKey,
    mode: value.mode as GenerationMode,
    retryImageBase64: value.retryImageBase64 as string | undefined,
    retryMimeType: value.retryMimeType as string | undefined,
  };
}
