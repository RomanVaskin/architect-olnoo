import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGeometryReviewParts, buildGeometryReviewPrompt } from "./gemini-geometry-reviewer";
import type { GeometryReviewRequest } from "./geometry-reviewer";

function requestWithReferences(): GeometryReviewRequest {
  return {
    primaryImage: { data: Buffer.from("primary"), mimeType: "image/png", role: "front", purpose: "primary" },
    referenceImages: [
      { data: Buffer.from("side"), mimeType: "image/jpeg", role: "side", purpose: "reference" },
      { data: Buffer.from("rear"), mimeType: "image/webp", role: "rear", purpose: "reference" },
    ],
    generatedImage: { data: Buffer.from("generated"), mimeType: "image/png" },
    constraints: { goal: "Редизайн", explicitChanges: "Фасад", mustKeep: ["Крыша"], mayChange: ["Материалы"] },
  };
}

test("review payload keeps Primary and generated images first, then appends reference-only source views", () => {
  const parts = buildGeometryReviewParts(requestWithReferences());
  const labels = parts.filter((part): part is { text: string } => "text" in part).map((part) => part.text);
  const images = parts.filter((part): part is { inlineData: { mimeType: string; data: string } } => "inlineData" in part);

  assert.equal(images.length, 4);
  assert.equal(Buffer.from(images[0].inlineData.data, "base64").toString(), "primary");
  assert.equal(Buffer.from(images[1].inlineData.data, "base64").toString(), "generated");
  assert.equal(Buffer.from(images[2].inlineData.data, "base64").toString(), "side");
  assert.equal(Buffer.from(images[3].inlineData.data, "base64").toString(), "rear");
  assert.ok(labels.some((label) => label.includes("IMAGE 3 — ORIGINAL REFERENCE VIEW (side)")));
  assert.ok(labels.some((label) => label.includes("IMAGE 4 — ORIGINAL REFERENCE VIEW (rear)")));
});

test("review prompt treats reference views as identity context, not output-camera targets", () => {
  const prompt = buildGeometryReviewPrompt(["Крыша"], 2);
  assert.match(prompt, /reference views of the same original building/i);
  assert.match(prompt, /do not require their camera angles to match IMAGE 2/i);
  assert.match(prompt, /User must-keep constraints: Крыша/);
});
