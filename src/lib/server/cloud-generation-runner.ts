import { GenerationError } from "@/lib/ai/errors";
import { resolveEffectiveMode, resolveModelSpec } from "@/lib/ai/model-registry";
import { getProvider } from "@/lib/ai/provider";
import { withGenerationSlot } from "@/lib/ai/concurrency";
import { notRunGeometryReport, reviewGeometrySafely } from "@/lib/ai/geometry-reviewer";
import { getGeometryReviewer } from "@/lib/ai/reviewer-provider";
import type { ArchitecturalConstraints, SourceImageInput } from "@/lib/ai/types";
import type { GenerationMode, GeometryVerificationReport } from "@/lib/types";

/**
 * Orchestrates one paid provider call + optional Reviewer call for a cloud
 * (Supabase-backed) project. Deliberately a separate module from
 * src/app/api/concepts/generate/route.ts and .../correct/route.ts (which
 * must keep working unchanged for local `local-*` projects) — this reuses
 * the same lower-level primitives (provider, model-registry, reviewer,
 * concurrency, errors) but has its own orchestration so the tested local
 * routes are never at risk of a cloud-path regression.
 */

const VARIANT_TIMEOUT_MS = 90_000;
const REVIEW_TIMEOUT_MS = 45_000;

export interface RunCloudGenerationInput {
  mode: GenerationMode;
  /** Sent to the provider in order — element 0 is always the edit target. */
  images: SourceImageInput[];
  constraints: ArchitecturalConstraints;
  autoReview: boolean;
  promptOverride?: string;
  imageLabels?: string[];
  /** Reviewer inputs, when they differ from `images` (Part 3 correction: element 0 of `images` is the concept being corrected, not the geometry reference). Defaults to images[0]/images.slice(1). */
  reviewerPrimaryImage?: SourceImageInput;
  reviewerReferenceImages?: SourceImageInput[];
}

export type RunCloudGenerationResult =
  | {
      status: "succeeded";
      effectiveMode: Exclude<GenerationMode, "auto">;
      mimeType: string;
      imageBase64: string;
      warnings: string[];
      geometryVerification: GeometryVerificationReport;
    }
  | {
      status: "failed";
      effectiveMode: Exclude<GenerationMode, "auto">;
      error: { code: string; message: string };
    };

/** Every code here means the provider call's billing outcome is genuinely unknown to us — never advance the attempt past "dispatched" for these. */
export const AMBIGUOUS_GENERATION_ERROR_CODES = new Set(["provider-timeout", "provider-failure"]);
/** Billed (provider responded) but nothing usable came out of it — distinct from the ambiguous set above, but still requires user acknowledgement before a new paid attempt. */
export const BILLED_BUT_UNUSABLE_ERROR_CODES = new Set(["malformed-response"]);

export async function runCloudGenerationVariant(input: RunCloudGenerationInput): Promise<RunCloudGenerationResult> {
  const modelSpec = resolveModelSpec(input.mode);
  const effectiveMode = resolveEffectiveMode(input.mode);
  const provider = getProvider(modelSpec);
  const reviewer = getGeometryReviewer();

  return withGenerationSlot<RunCloudGenerationResult>(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VARIANT_TIMEOUT_MS);
    try {
      const result = await provider.generate(
        modelSpec,
        {
          images: input.images,
          constraints: input.constraints,
          variantIndex: 1,
          variantCount: 1,
          promptOverride: input.promptOverride,
          imageLabels: input.imageLabels,
        },
        controller.signal,
      );
      clearTimeout(timer);

      let geometryVerification = notRunGeometryReport(
        input.autoReview ? "Автоматическую AI-проверку выполнить не удалось." : "Автоматическая AI-проверка отключена пользователем.",
      );
      if (input.autoReview) {
        const reviewController = new AbortController();
        const reviewTimer = setTimeout(() => reviewController.abort(), REVIEW_TIMEOUT_MS);
        try {
          geometryVerification = await reviewGeometrySafely(
            reviewer,
            {
              primaryImage: input.reviewerPrimaryImage ?? input.images[0],
              referenceImages: input.reviewerReferenceImages ?? input.images.slice(1),
              generatedImage: { data: Buffer.from(result.imageBase64, "base64"), mimeType: result.mimeType },
              constraints: input.constraints,
            },
            reviewController.signal,
            logReviewFailure,
          );
        } finally {
          clearTimeout(reviewTimer);
        }
      }

      return { status: "succeeded", effectiveMode, mimeType: result.mimeType, imageBase64: result.imageBase64, warnings: result.warnings, geometryVerification };
    } catch (error) {
      clearTimeout(timer);
      const generationError = error instanceof GenerationError ? error : new GenerationError("provider-failure");
      logGenerationFailure(generationError);
      return { status: "failed", effectiveMode, error: { code: generationError.code, message: generationError.userMessage } };
    }
  });
}

function logReviewFailure(error: unknown) {
  console.warn("[cloud-concepts:review]", { code: error instanceof Error ? error.name : "UnknownError" });
}

function logGenerationFailure(error: GenerationError) {
  console.error(`[cloud-concepts:generate] ${error.code}`);
}
