import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArchitecturalPrompt } from "./prompt-builder";

const constraints = {
  goal: "Light facade",
  explicitChanges: "Replace dark brick",
  mustKeep: ["Geometry"],
  mayChange: ["Materials"],
};

test("multi-view prompt keeps image 1 as the only output camera and forbids collages", () => {
  const prompt = buildArchitecturalPrompt(constraints, 1, 1, [
    { role: "front", purpose: "primary" },
    { role: "side", purpose: "reference" },
    { role: "rear", purpose: "reference" },
  ]);

  assert.match(prompt, /Image 1 is the PRIMARY EDIT TARGET/);
  assert.match(prompt, /Images 2–3 are REFERENCE CONTEXT ONLY/);
  assert.match(prompt, /Output exactly one edited version of Image 1/);
  assert.match(prompt, /do not combine views into a collage/i);
});

test("single-view prompt does not add irrelevant reference instructions", () => {
  const prompt = buildArchitecturalPrompt(constraints, 1, 1, [{ role: "front", purpose: "primary" }]);
  assert.doesNotMatch(prompt, /REFERENCE CONTEXT ONLY/);
});
