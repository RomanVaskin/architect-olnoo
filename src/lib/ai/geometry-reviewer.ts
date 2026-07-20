import type {
  GeometryCheckKey,
  GeometryCheckStatus,
  GeometryVerificationCheck,
  GeometryVerificationReport,
} from "@/lib/types";
import type { ArchitecturalConstraints, SourceImageInput } from "./types";

export const GEOMETRY_REVIEW_ADVISORY =
  "Предварительная AI-проверка по изображениям не заменяет проверку архитектора или другого квалифицированного специалиста.";

export const GEOMETRY_CHECK_KEYS: GeometryCheckKey[] = ["camera", "volumes", "roof", "openings", "proportions"];

export interface GeometryReviewRequest {
  primaryImage: SourceImageInput;
  generatedImage: { data: Buffer; mimeType: string };
  constraints: ArchitecturalConstraints;
}

export interface GeometryReviewProvider {
  review(request: GeometryReviewRequest, signal: AbortSignal): Promise<GeometryVerificationReport>;
}

/** Reviewer failures are non-fatal: the already generated image must survive. */
export async function reviewGeometrySafely(
  provider: GeometryReviewProvider,
  request: GeometryReviewRequest,
  signal: AbortSignal,
  onError?: (error: unknown) => void,
): Promise<GeometryVerificationReport> {
  try {
    return await provider.review(request, signal);
  } catch (error) {
    onError?.(error);
    return notRunGeometryReport();
  }
}

interface RawCheck {
  key?: unknown;
  status?: unknown;
  confidence?: unknown;
  explanation?: unknown;
}

export function notRunGeometryReport(summary = "Автоматическую AI-проверку выполнить не удалось."): GeometryVerificationReport {
  return { status: "not-run", confidence: 0, summary, checks: [], advisory: GEOMETRY_REVIEW_ADVISORY };
}

export function parseGeometryReview(rawText: string): GeometryVerificationReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("invalid-review-json");
  }
  const value = parsed as { checks?: unknown; summary?: unknown };
  if (!Array.isArray(value?.checks)) throw new Error("invalid-review-checks");

  const checks = value.checks.map(parseCheck);
  if (checks.length !== GEOMETRY_CHECK_KEYS.length || new Set(checks.map((check) => check.key)).size !== GEOMETRY_CHECK_KEYS.length) {
    throw new Error("incomplete-review-checks");
  }
  if (!GEOMETRY_CHECK_KEYS.every((key) => checks.some((check) => check.key === key))) throw new Error("missing-review-check");

  const highConfidenceDeviation = checks.some((check) => check.status === "possible-deviation" && check.confidence >= 0.7);
  const allConsistent = checks.every((check) => check.status === "consistent" && check.confidence >= 0.7);
  const confidence = roundConfidence(checks.reduce((sum, check) => sum + check.confidence, 0) / checks.length);
  const status = highConfidenceDeviation
    ? "possible-deviations"
    : allConsistent
      ? "no-obvious-deviations"
      : "inconclusive";
  const fallbackSummary =
    status === "possible-deviations"
      ? "AI-анализ обнаружил возможные геометрические расхождения."
      : status === "no-obvious-deviations"
        ? "AI-анализ не обнаружил явных геометрических расхождений."
        : "AI-анализ не дал достаточно уверенного результата.";

  return {
    status,
    confidence,
    summary: typeof value.summary === "string" && value.summary.trim() ? value.summary.trim().slice(0, 500) : fallbackSummary,
    checks,
    advisory: GEOMETRY_REVIEW_ADVISORY,
  };
}

function parseCheck(raw: RawCheck): GeometryVerificationCheck {
  const key = raw?.key;
  const status = raw?.status;
  const confidence = raw?.confidence;
  const explanation = raw?.explanation;
  if (!GEOMETRY_CHECK_KEYS.includes(key as GeometryCheckKey)) throw new Error("invalid-review-key");
  if (!(["consistent", "possible-deviation", "uncertain"] as GeometryCheckStatus[]).includes(status as GeometryCheckStatus)) {
    throw new Error("invalid-review-status");
  }
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("invalid-review-confidence");
  }
  if (typeof explanation !== "string" || !explanation.trim()) throw new Error("invalid-review-explanation");
  return {
    key: key as GeometryCheckKey,
    status: status as GeometryCheckStatus,
    confidence: roundConfidence(confidence),
    explanation: explanation.trim().slice(0, 500),
  };
}

function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}
