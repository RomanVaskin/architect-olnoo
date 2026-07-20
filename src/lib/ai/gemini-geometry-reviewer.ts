import { getGeminiClient } from "./gemini-client";
import { parseGeometryReview, type GeometryReviewProvider } from "./geometry-reviewer";

export const GEOMETRY_REVIEW_MODEL = process.env.GEMINI_REVIEW_MODEL || "gemini-2.5-flash";

export const GEOMETRY_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "checks"],
  properties: {
    summary: { type: "string" },
    checks: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "status", "confidence", "explanation"],
        properties: {
          key: { type: "string", enum: ["camera", "volumes", "roof", "openings", "proportions"] },
          status: { type: "string", enum: ["consistent", "possible-deviation", "uncertain"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          explanation: { type: "string" },
        },
      },
    },
  },
} as const;

export function buildGeometryReviewPrompt(mustKeep: string[]): string {
  return [
    "You are an architectural visual-comparison reviewer.",
    "Compare IMAGE 1 (the original Primary View) with IMAGE 2 (the generated redesign).",
    "Evaluate only visible geometric consistency. Ignore intended changes to materials, colors, lighting, landscaping, furniture and weather.",
    "Check exactly these five categories: camera/perspective, overall volumes and storeys, roof geometry, window/door opening positions, overall proportions/footprint.",
    "Use possible-deviation only when a visible discrepancy exists; use uncertain when occlusion, crop or image quality prevents a reliable comparison.",
    "Do not claim professional approval, construction accuracy, exact dimensions, code compliance or certification.",
    `User must-keep constraints: ${mustKeep.length ? mustKeep.join("; ") : "none supplied"}.`,
    "Write summary and explanations in Russian. Return only the requested JSON.",
  ].join("\n");
}

export const geminiGeometryReviewer: GeometryReviewProvider = {
  async review(request, signal) {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEOMETRY_REVIEW_MODEL,
      contents: [{
        role: "user",
        parts: [
          { text: buildGeometryReviewPrompt(request.constraints.mustKeep) },
          { text: "IMAGE 1 — ORIGINAL PRIMARY VIEW" },
          { inlineData: { mimeType: request.primaryImage.mimeType, data: request.primaryImage.data.toString("base64") } },
          { text: "IMAGE 2 — GENERATED REDESIGN" },
          { inlineData: { mimeType: request.generatedImage.mimeType, data: request.generatedImage.data.toString("base64") } },
        ],
      }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: GEOMETRY_REVIEW_SCHEMA,
        temperature: 0,
        abortSignal: signal,
        httpOptions: { timeout: 45_000 },
      },
    });
    if (!response.text) throw new Error("empty-review-response");
    return parseGeometryReview(response.text);
  },
};
