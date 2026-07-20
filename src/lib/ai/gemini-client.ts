import { GoogleGenAI } from "@google/genai";
import { GenerationError } from "./errors";

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GenerationError("missing-api-key");
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}
