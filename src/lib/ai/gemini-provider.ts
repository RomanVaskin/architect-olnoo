import { GoogleGenAI, FinishReason, Modality } from "@google/genai";
import { buildArchitecturalPrompt } from "./prompt-builder";
import { GenerationError } from "./errors";
import type { GenerationRequest, GenerationResult, ImageGenerationProvider, ModelSpec, SourceImageInput } from "./types";

const REJECTED_FINISH_REASONS = new Set<FinishReason>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.RECITATION,
]);

let client: GoogleGenAI | null = null;

const ROLE_LABELS: Record<SourceImageInput["role"], string> = {
  front: "front facade",
  side: "side facade",
  rear: "rear facade",
  detail: "detail",
  other: "other view",
};

export function buildGeminiImageParts(images: SourceImageInput[]) {
  return images.flatMap((image, index) => [
    {
      text:
        image.purpose === "primary"
          ? `IMAGE ${index + 1}: PRIMARY EDIT TARGET — ${ROLE_LABELS[image.role]}. Edit this image and preserve its camera exactly.`
          : `IMAGE ${index + 1}: REFERENCE CONTEXT ONLY — ${ROLE_LABELS[image.role]}. Do not use this camera angle for the output.`,
    },
    { inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") } },
  ]);
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GenerationError("missing-api-key");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export const geminiProvider: ImageGenerationProvider = {
  async generate(spec: ModelSpec, request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult> {
    const ai = getClient();
    const prompt = buildArchitecturalPrompt(request.constraints, request.variantIndex, request.variantCount, request.images);

    let response;
    try {
      response = await ai.models.generateContent({
        model: spec.model,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...buildGeminiImageParts(request.images),
            ],
          },
        ],
        config: {
          responseModalities: [Modality.IMAGE],
          abortSignal: signal,
          httpOptions: { timeout: 90_000 },
        },
      });
    } catch (error) {
      throw mapProviderError(error);
    }

    if (response.promptFeedback?.blockReason) {
      throw new GenerationError("safety-rejection");
    }

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason && REJECTED_FINISH_REASONS.has(candidate.finishReason)) {
      throw new GenerationError("safety-rejection");
    }

    const parts = candidate?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData?.data);
    const warnings = parts
      .filter((part) => typeof part.text === "string" && part.text.trim().length > 0)
      .map((part) => part.text as string);

    if (!imagePart?.inlineData?.data) {
      throw new GenerationError("malformed-response");
    }

    return {
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || "image/png",
      warnings,
    };
  },
};

/**
 * Gemini's ApiError does not expose a structured "quota is permanently zero"
 * flag — the only signal is the numeric limit embedded in the free-form
 * message text (e.g. "...generate_content_free_tier_requests, limit: 0,
 * model: ..."). A positive limit that was merely burst through (a transient
 * per-minute/per-day rate limit) reads as "limit: <N>" with N > 0. This is
 * used only to pick an error code — the raw provider text itself is never
 * logged or sent to the client (see errors.ts).
 */
export function isQuotaExhaustedMessage(rawMessage: string): boolean {
  let text = rawMessage;
  try {
    const parsed = JSON.parse(rawMessage) as { error?: { message?: string } };
    if (typeof parsed?.error?.message === "string") {
      text = parsed.error.message;
    }
  } catch {
    // Not a JSON error body — fall back to scanning the raw text below.
  }
  return /limit:\s*0\b/i.test(text);
}

export function mapProviderError(error: unknown): GenerationError {
  if (error instanceof GenerationError) return error;

  if (error instanceof Error && error.name === "AbortError") {
    return new GenerationError("provider-timeout");
  }

  const status = (error as { status?: number } | null)?.status;
  if (status === 429) {
    const rawMessage = error instanceof Error ? error.message : "";
    return isQuotaExhaustedMessage(rawMessage) ? new GenerationError("quota-exhausted") : new GenerationError("rate-limit");
  }
  if (status === 408 || status === 504) return new GenerationError("provider-timeout");

  return new GenerationError("provider-failure");
}
