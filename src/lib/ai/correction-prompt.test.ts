import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCorrectionPrompt } from "./correction-prompt";

const constraints = {
  goal: "Сделать фасад светлее",
  explicitChanges: "Светлая штукатурка",
  mustKeep: ["Геометрия", "Окна"],
  mayChange: ["Материалы"],
};

test("correction prompt edits the generated concept against the original primary view", () => {
  const prompt = buildCorrectionPrompt(constraints, ["roof: changed pitch", "openings: moved window"], true);

  assert.match(prompt, /IMAGE 1 is the GENERATED CONCEPT TO EDIT/);
  assert.match(prompt, /IMAGE 2 is the ORIGINAL PRIMARY VIEW/);
  assert.match(prompt, /IMAGE 3 is an ORIGINAL REFERENCE VIEW/);
  assert.match(prompt, /roof: changed pitch/);
  assert.match(prompt, /openings: moved window/);
  assert.match(prompt, /Correct only the listed Quality Gate findings/);
  assert.match(prompt, /Do not introduce any unrelated redesign/);
});

test("correction prompt never invents a missing reference view", () => {
  const prompt = buildCorrectionPrompt(constraints, ["volume: possible deviation"], false);
  assert.match(prompt, /No additional original reference view is available/);
  assert.doesNotMatch(prompt, /IMAGE 3 is an ORIGINAL REFERENCE VIEW/);
});
