import { geminiProvider } from "./gemini-provider";
import type { ImageGenerationProvider, ModelSpec } from "./types";

/**
 * Resolves a ModelSpec to a concrete provider adapter. Adding OpenAI or FLUX
 * later means adding a case here — the API route and everything above it
 * only ever deals with GenerationMode / ModelSpec, never a provider directly.
 */
export function getProvider(spec: ModelSpec): ImageGenerationProvider {
  switch (spec.provider) {
    case "gemini":
      return geminiProvider;
    default:
      throw new Error(`Unknown provider: ${spec.provider satisfies never}`);
  }
}
