import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProjectImportPackage, parseProjectImportManifest, validateProjectImportManifest } from "./project-import-contract";
import type { Project } from "./types";

function projectFixture(): Project {
  const sourceBlob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
  const conceptBlob = new Blob([new Uint8Array([4, 5, 6])], { type: "image/png" });
  return {
    id: "local-project-1",
    name: "Дом",
    buildingType: "Частный дом",
    coverImage: "local-project-1",
    lifecycleStage: "concept",
    state: "awaiting-review",
    updatedAt: "2026-07-20T00:00:00.000Z",
    site: { address: "Москва", climateZone: "Холодный", areaSqm: 1000 },
    brief: { goal: "Обновить фасад", mustKeep: ["Крыша"], mayChange: ["Материал"], wantsChanged: ["Фасад"] },
    sourceFiles: [{ id: "source-1", name: "house.jpg", kind: "photo", uploadedAt: "2026-07-20T00:00:00.000Z", mimeType: "image/jpeg", imageBlob: sourceBlob }],
    sourceViews: [{ id: "view-1", sourceImageId: "source-1", crop: { x: 0, y: 0, width: 10, height: 10 }, order: 0, role: "front", isPrimary: true, imageKey: "source-1:image" }],
    concepts: [{ id: "concept-1", label: "A", createdAt: "2026-07-20T00:00:00.000Z", state: "awaiting-review", summary: "", changeExplanation: "", generatedImage: { blob: conceptBlob, mimeType: "image/png", mode: "balanced", warnings: [] } }],
    selectedConceptId: "concept-1",
    versions: [],
    feedback: [],
    activity: [],
  };
}

test("buildProjectImportPackage separates binary assets from the JSON manifest", () => {
  const result = buildProjectImportPackage(projectFixture());
  assert.equal(result.assets.length, 2);
  assert.deepEqual(result.assets.map((item) => item.blob.size), [3, 3]);
  const json = JSON.stringify(result.manifest);
  assert.doesNotMatch(json, /imageBlob|\"blob\"/);
  assert.equal(parseProjectImportManifest(json).localProjectId, "local-project-1");
});

test("manifest validation rejects missing, duplicate and unreferenced assets", () => {
  const manifest = structuredClone(buildProjectImportPackage(projectFixture()).manifest);
  manifest.assets[1].field = manifest.assets[0].field;
  assert.throws(() => validateProjectImportManifest(manifest), /Duplicate asset field/);

  const unreferenced = structuredClone(buildProjectImportPackage(projectFixture()).manifest);
  unreferenced.project.concepts[0].generatedImage = undefined;
  assert.throws(() => validateProjectImportManifest(unreferenced), /unreferenced asset/);
});

test("manifest validation rejects non-local project identities", () => {
  const manifest = structuredClone(buildProjectImportPackage(projectFixture()).manifest);
  manifest.localProjectId = "server-project";
  manifest.project.id = "server-project";
  assert.throws(() => validateProjectImportManifest(manifest), /Invalid local project id/);
});

test("manifest validation requires exactly one primary source view", () => {
  const manifest = structuredClone(buildProjectImportPackage(projectFixture()).manifest);
  manifest.project.sourceViews[0].isPrimary = false;
  assert.throws(() => validateProjectImportManifest(manifest), /Exactly one source view must be primary/);

  manifest.project.sourceViews.push({
    ...manifest.project.sourceViews[0],
    id: "view-2",
    isPrimary: true,
  });
  manifest.project.sourceViews[0].isPrimary = true;
  assert.throws(() => validateProjectImportManifest(manifest), /Exactly one source view must be primary/);
});

test("manifest validation rejects unsupported binary types and invalid crop coordinates", () => {
  const unsupported = structuredClone(buildProjectImportPackage(projectFixture()).manifest);
  unsupported.assets[0].mimeType = "image/svg+xml";
  assert.throws(() => validateProjectImportManifest(unsupported), /Unsupported asset type/);

  const invalidCrop = structuredClone(buildProjectImportPackage(projectFixture()).manifest);
  invalidCrop.project.sourceViews[0].crop.x = -1;
  assert.throws(() => validateProjectImportManifest(invalidCrop), /Invalid source view crop/);
});
