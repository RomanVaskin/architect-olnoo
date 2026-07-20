import { NextRequest, NextResponse } from "next/server";
import type { GeometryVerificationReport } from "@/lib/types";
import { GenerationError } from "@/lib/ai/errors";
import { validateGenerationForm } from "@/lib/ai/request-validation";
import { resolveEffectiveMode, resolveModelSpec } from "@/lib/ai/model-registry";
import { getProvider } from "@/lib/ai/provider";
import { withGenerationSlot } from "@/lib/ai/concurrency";
import { notRunGeometryReport, reviewGeometrySafely } from "@/lib/ai/geometry-reviewer";
import { getGeometryReviewer } from "@/lib/ai/reviewer-provider";

export const runtime = "nodejs";

// TODO: this route has no authentication and no per-user/IP rate limiting.
// Both must be added before this endpoint is exposed in a public deployment
// (see docs/09-TODO.md) — it currently relies on the app being unauthenticated
// MVP-only and on the process-wide generation concurrency cap in
// src/lib/ai/concurrency.ts, which is not a substitute for real rate limiting.

const VARIANT_TIMEOUT_MS = 90_000;
const REVIEW_TIMEOUT_MS = 45_000;

interface VariantResponse {
  status: "succeeded" | "failed";
  mode: string;
  mimeType?: string;
  imageBase64?: string;
  warnings: string[];
  geometryVerification: GeometryVerificationReport;
  error?: { code: string; message: string };
}

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return errorResponse(new GenerationError("missing-api-key"), 500);
  }

  let input;
  try {
    const formData = await request.formData();
    input = await validateGenerationForm(formData);
  } catch (error) {
    return errorResponse(error, 400);
  }

  const modelSpec = resolveModelSpec(input.mode);
  const effectiveMode = resolveEffectiveMode(input.mode);
  const provider = getProvider(modelSpec);
  const reviewer = getGeometryReviewer();

  const variants: VariantResponse[] = await Promise.all(
    Array.from({ length: input.variantCount }, (_, index) =>
      withGenerationSlot<VariantResponse>(async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), VARIANT_TIMEOUT_MS);
        try {
          const result = await provider.generate(
            modelSpec,
            {
              images: input.images,
              constraints: input.constraints,
              variantIndex: index + 1,
              variantCount: input.variantCount,
            },
            controller.signal,
          );
          clearTimeout(timer);

          let geometryVerification = notRunGeometryReport(
            input.autoReview
              ? "Автоматическую AI-проверку выполнить не удалось."
              : "Автоматическая AI-проверка отключена пользователем.",
          );
          if (input.autoReview) {
            const reviewController = new AbortController();
            const reviewTimer = setTimeout(() => reviewController.abort(), REVIEW_TIMEOUT_MS);
            try {
              geometryVerification = await reviewGeometrySafely(
                reviewer,
                {
                  primaryImage: input.images[0],
                  referenceImages: input.images.slice(1),
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
          return {
            status: "succeeded",
            mode: effectiveMode,
            mimeType: result.mimeType,
            imageBase64: result.imageBase64,
            warnings: result.warnings,
            geometryVerification,
          };
        } catch (error) {
          const generationError = error instanceof GenerationError ? error : new GenerationError("provider-failure");
          logGenerationFailure(generationError);
          return {
            status: "failed",
            mode: effectiveMode,
            warnings: [],
            geometryVerification: notRunGeometryReport("Концепция не была создана, поэтому AI-проверка не выполнялась."),
            error: { code: generationError.code, message: generationError.userMessage },
          };
        } finally {
          clearTimeout(timer);
        }
      }),
    ),
  );

  return NextResponse.json({ variants });
}

function logReviewFailure(error: unknown) {
  const code = error instanceof Error ? error.name : "UnknownError";
  // No raw message, model response, prompt or image bytes are logged.
  console.warn("[concepts/review]", { code });
}

function errorResponse(error: unknown, status: number) {
  const generationError = error instanceof GenerationError ? error : new GenerationError("provider-failure");
  logGenerationFailure(generationError);
  return NextResponse.json({ error: { code: generationError.code, message: generationError.userMessage } }, { status });
}

function logGenerationFailure(error: GenerationError) {
  // Deliberately logs only the error code — never image bytes, prompts, or secrets.
  console.error(`[concepts/generate] ${error.code}`);
}
