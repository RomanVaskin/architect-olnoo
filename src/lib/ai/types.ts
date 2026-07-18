import type { GenerationMode } from "@/lib/types";

/** A single source image already decoded to bytes, ready to send to a provider. */
export interface SourceImageInput {
  data: Buffer;
  mimeType: string;
}

export interface ArchitecturalConstraints {
  goal: string;
  explicitChanges: string;
  mustKeep: string[];
  mayChange: string[];
}

export interface GenerationRequest {
  images: SourceImageInput[];
  constraints: ArchitecturalConstraints;
  /** 1-based index of this variant and the total requested, used only to nudge the model toward distinct outputs. */
  variantIndex: number;
  variantCount: number;
}

export interface GenerationResult {
  imageBase64: string;
  mimeType: string;
  /** Non-fatal notes surfaced from the provider response (e.g. accompanying text). */
  warnings: string[];
}

/** Identifies a concrete provider + model. Never exposed to the client. */
export interface ModelSpec {
  provider: "gemini";
  model: string;
}

export interface ImageGenerationProvider {
  generate(spec: ModelSpec, request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult>;
}

export type { GenerationMode };
