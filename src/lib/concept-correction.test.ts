import { test } from "node:test";
import assert from "node:assert/strict";
import { canCreateCorrectedVersion, correctionFindings, prepareConceptCorrection } from "./concept-correction";
import type { Concept, Project } from "./types";

const provenance = {
  sourceFileId: "source-1",
  sourceViewId: "view-primary",
  sourceFileName: "house.png",
  role: "front" as const,
  crop: { x: 0, y: 0, width: 100, height: 100 },
  payload: { mimeType: "image/png", width: 100, height: 100, sizeBytes: 3 },
  referenceViews: [{
    sourceFileId: "source-1",
    sourceViewId: "view-reference",
    sourceFileName: "house.png",
    role: "side" as const,
    crop: { x: 0, y: 50, width: 100, height: 50 },
    payload: { mimeType: "image/png", width: 100, height: 50, sizeBytes: 2 },
  }],
};

function makeConcept(status: "possible-deviations" | "no-obvious-deviations" = "possible-deviations"): Concept {
  return {
    id: "concept-1",
    label: "Concept 1",
    createdAt: new Date(0).toISOString(),
    state: "needs-specialist-review",
    summary: "summary",
    changeExplanation: "change",
    generatedImage: { blob: new Blob(["generated"], { type: "image/png" }), mimeType: "image/png", mode: "balanced", warnings: [] },
    sourceProvenance: provenance,
    geometryVerification: {
      status,
      confidence: 0.8,
      summary: "summary",
      advisory: "review",
      checks: [
        { key: "roof", status: status === "possible-deviations" ? "possible-deviation" : "consistent", confidence: 0.85, explanation: "changed pitch" },
        { key: "camera", status: "consistent", confidence: 0.9, explanation: "unchanged" },
      ],
    },
  };
}

function makeProject(): Project {
  return {
    id: "project-1",
    name: "House",
    buildingType: "Private house",
    coverImage: "",
    lifecycleStage: "concept",
    state: "awaiting-review",
    updatedAt: new Date(0).toISOString(),
    site: { address: "", climateZone: "", areaSqm: 0 },
    brief: { goal: "goal", mustKeep: [], mayChange: [], wantsChanged: [] },
    sourceFiles: [{ id: "source-1", name: "house.png", kind: "photo", uploadedAt: new Date(0).toISOString(), mimeType: "image/png", dimensions: { width: 100, height: 100 }, imageBlob: new Blob(["src"], { type: "image/png" }) }],
    concepts: [],
    selectedConceptId: null,
    versions: [],
    feedback: [],
    activity: [],
  };
}

test("only concrete possible deviations make a concept eligible for correction", () => {
  const eligible = makeConcept();
  assert.equal(canCreateCorrectedVersion(eligible), true);
  assert.deepEqual(correctionFindings(eligible), ["roof: changed pitch"]);
  assert.equal(canCreateCorrectedVersion(makeConcept("no-obvious-deviations")), false);
});

test("prepares current concept, original primary, and at most one original reference before any request", async () => {
  const crops: Array<{ y: number; height: number }> = [];
  const prepared = await prepareConceptCorrection(makeProject(), makeConcept(), async (_source, crop, mimeType) => {
    crops.push({ y: crop.y, height: crop.height });
    return new Blob(["crop"], { type: mimeType });
  });

  assert.equal(prepared.files.length, 3);
  assert.deepEqual(prepared.roles, ["other", "front", "side"]);
  assert.deepEqual(prepared.findings, ["roof: changed pitch"]);
  assert.equal(await prepared.files[0].text(), "generated");
  assert.equal(await prepared.files[1].text(), "src");
  assert.deepEqual(crops, [{ y: 50, height: 50 }]);
});

test("stops locally when the original source bytes are unavailable", async () => {
  const project = makeProject();
  project.sourceFiles[0].imageBlob = undefined;
  await assert.rejects(() => prepareConceptCorrection(project, makeConcept()), /недоступно в этом браузере/);
});
