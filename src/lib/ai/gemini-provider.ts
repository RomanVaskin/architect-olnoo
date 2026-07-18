import { GoogleGenAI, FinishReason, Modality } from "@google/genai";
import { buildArchitecturalPrompt } from "./prompt-builder";
import { GenerationError } from "./errors";
import type { GenerationRequest, GenerationResult, ImageGenerationProvider, ModelSpec } from "./types";

const REJECTED_FINISH_REASONS = new Set<FinishReason>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.RECITATION,
]);

let client: GoogleGenAI | null = null;

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
    const prompt = buildArchitecturalPrompt(request.constraints, request.variantIndex, request.variantCount);

    let response;
    try {
      response = await ai.models.generateContent({
        model: spec.model,
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...request.images.map((image) => ({
                inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") },
              })),
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

function mapProviderError(error: unknown): GenerationError {
  if (error instanceof GenerationError) return error;

  if (error instanceof Error && error.name === "AbortError") {
    return new GenerationError("provider-timeout");
  }

  const status = (error as { status?: number } | null)?.status;
  if (status === 429) return new GenerationError("rate-limit");
  if (status === 408 || status === 504) return new GenerationError("provider-timeout");

  return new GenerationError("provider-failure");
}
