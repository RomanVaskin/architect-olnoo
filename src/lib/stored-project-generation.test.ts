import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalGenerationFormData,
  buildStoredProjectGenerationInputs,
  canGenerateFromStoredProject,
} from "./stored-project-generation";
import { buildConceptSourceProvenance, prepareGenerationViews } from "./primary-view-generation";
import { requestAndDecodeConcepts } from "./concept-generation-flow";
import { buildSourceRecords } from "./source-view-builder";
import type { Project } from "./types";

const PHOTO_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 42, 42, 42, 42]);

/** A project exactly as getLocalProject returns a saved draft: PDF first so raster indices are non-trivial. */
function storedDraft(): Project {
  const id = "local-stored-draft";
  return {
    id,
    name: "Черновик с материалами",
    buildingType: "Частный дом",
    coverImage: id,
    lifecycleStage: "intake",
    state: "draft",
    updatedAt: "2026-07-21T00:00:00.000Z",
    site: { address: "Не указано", climateZone: "Не указано", areaSqm: 0 },
    brief: {
      goal: "Сделать фасад светлее, сохранив форму дома",
      mustKeep: ["Геометрия и основные пропорции"],
      mayChange: ["Цветовая палитра"],
      wantsChanged: ["Покрасить стены фасада в белый цвет"],
    },
    sourceFiles: [
      { id: `${id}-src-0`, name: "plan.pdf", kind: "document", uploadedAt: "t" },
      {
        id: `${id}-src-1`,
        name: "facade.jpg",
        kind: "photo",
        uploadedAt: "t",
        imageKey: `${id}-src-1:image`,
        mimeType: "image/jpeg",
        dimensions: { width: 40, height: 30 },
        imageBlob: new Blob([PHOTO_BYTES], { type: "image/jpeg" }),
      },
    ],
    sourceViews: [
      { id: `${id}-view-0`, sourceImageId: `${id}-src-1`, crop: { x: 0, y: 0, width: 40, height: 30 }, order: 0, role: "front", isPrimary: true, imageKey: `${id}-src-1:image` },
      { id: `${id}-view-1`, sourceImageId: `${id}-src-1`, crop: { x: 0, y: 0, width: 20, height: 30 }, order: 1, role: "side", isPrimary: false, imageKey: `${id}-src-1:image` },
    ],
    concepts: [],
    selectedConceptId: null,
    versions: [],
    feedback: [],
    activity: [],
  };
}

test("a saved draft with a Primary View, stored bytes, and dimensions can start generation later", () => {
  assert.equal(canGenerateFromStoredProject(storedDraft()), true);
});

test("generation later is not offered when materials are insufficient", () => {
  const draft = storedDraft();

  const withoutViews = { ...draft, sourceViews: [] };
  assert.equal(canGenerateFromStoredProject(withoutViews), false, "no confirmed views");

  const withoutPrimary = { ...draft, sourceViews: draft.sourceViews!.map((view) => ({ ...view, isPrimary: false })) };
  assert.equal(canGenerateFromStoredProject(withoutPrimary), false, "no Primary View");

  const withoutBytes = { ...draft, sourceFiles: draft.sourceFiles.map((file) => ({ ...file, imageBlob: undefined })) };
  assert.equal(canGenerateFromStoredProject(withoutBytes), false, "image bytes missing in this browser");

  const withoutDimensions = { ...draft, sourceFiles: draft.sourceFiles.map((file) => ({ ...file, dimensions: undefined })) };
  assert.equal(canGenerateFromStoredProject(withoutDimensions), false, "dimensions unknown");
});

test("stored views become wizard-identical generation inputs: primary first, exact crops, original bytes", async () => {
  const draft = storedDraft();
  const inputs = buildStoredProjectGenerationInputs(draft);

  const cropCalls: Array<{ crop: unknown }> = [];
  const fakeCrop = async (source: Blob, crop: { x: number; y: number; width: number; height: number }) => {
    cropCalls.push({ crop });
    return source.slice(0, 6, "image/jpeg");
  };

  const prepared = await prepareGenerationViews(inputs.files, inputs.views, inputs.dimensionsByFileKey, fakeCrop);

  assert.equal(prepared.views.length, 2);
  assert.equal(prepared.views[0].isPrimary, true, "the Primary View is always the first image sent");
  assert.equal(prepared.views[0].role, "front");
  assert.deepEqual(prepared.views[0].crop, { x: 0, y: 0, width: 40, height: 30 });
  assert.equal(prepared.views[1].isPrimary, false);
  assert.equal(prepared.views[1].role, "side");

  // The full-frame Primary View reuses the stored bytes without re-encoding.
  const primaryBytes = new Uint8Array(await prepared.views[0].file.arrayBuffer());
  assert.deepEqual(Array.from(primaryBytes), Array.from(PHOTO_BYTES));

  // Only the partial reference view is cropped, with the exact stored rectangle.
  assert.equal(cropCalls.length, 1);
  assert.deepEqual(cropCalls[0].crop, { x: 0, y: 0, width: 20, height: 30 });
});

test("provenance from a stored draft points at the exact persisted source file and view ids", async () => {
  const draft = storedDraft();
  const inputs = buildStoredProjectGenerationInputs(draft);
  const prepared = await prepareGenerationViews(inputs.files, inputs.views, inputs.dimensionsByFileKey, async (source) => source.slice(0, 6, "image/jpeg"));

  const provenance = buildConceptSourceProvenance(draft.id, prepared.views[0], prepared.views.slice(1));

  // The PDF occupies index 0, so misaligned indices would produce -src-0 here.
  assert.equal(provenance.sourceFileId, `${draft.id}-src-1`);
  assert.equal(provenance.sourceViewId, `${draft.id}-view-0`);
  assert.equal(provenance.referenceViews?.[0].sourceFileId, `${draft.id}-src-1`);
  assert.equal(provenance.referenceViews?.[0].sourceViewId, `${draft.id}-view-1`);
});

test("draft data persisted through buildSourceRecords survives reload into the same generation inputs", async () => {
  const projectId = "local-roundtrip-draft";
  const { sourceFiles, sourceViews } = buildSourceRecords(
    projectId,
    "2026-07-21T00:00:00.000Z",
    [{ name: "facade.jpg", kind: "photo", hasImage: true, mimeType: "image/jpeg", dimensions: { width: 40, height: 30 } }],
    [{ sourceFileIndex: 0, crop: { x: 2, y: 3, width: 10, height: 12 }, order: 0, role: "front", isPrimary: true }],
  );

  // Reload: getLocalProject reattaches the stored bytes onto the persisted records.
  const hydrated: Project = {
    ...storedDraft(),
    id: projectId,
    sourceFiles: [{ ...sourceFiles[0], imageBlob: new Blob([PHOTO_BYTES], { type: "image/jpeg" }) }],
    sourceViews,
  };

  assert.equal(canGenerateFromStoredProject(hydrated), true);
  const inputs = buildStoredProjectGenerationInputs(hydrated);
  const cropRects: unknown[] = [];
  const prepared = await prepareGenerationViews(inputs.files, inputs.views, inputs.dimensionsByFileKey, async (source, crop) => {
    cropRects.push(crop);
    return source.slice(0, 4, "image/jpeg");
  });

  assert.equal(prepared.views.length, 1);
  assert.equal(prepared.views[0].isPrimary, true);
  assert.equal(prepared.views[0].role, "front");
  assert.deepEqual(cropRects, [{ x: 2, y: 3, width: 10, height: 12 }], "the confirmed crop survives persistence exactly");
  const provenance = buildConceptSourceProvenance(projectId, prepared.views[0], []);
  assert.equal(provenance.sourceFileId, sourceFiles[0].id);
  assert.equal(provenance.sourceViewId, sourceViews[0].id);
});

test("the request body for generation-from-draft matches the existing paid local route contract", async () => {
  const draft = storedDraft();
  const inputs = buildStoredProjectGenerationInputs(draft);
  const prepared = await prepareGenerationViews(inputs.files, inputs.views, inputs.dimensionsByFileKey, async (source) => source.slice(0, 6, "image/jpeg"));

  const formData = buildLocalGenerationFormData(prepared, draft.brief, { mode: "fast", variantCount: 1, autoReview: false });

  assert.equal(formData.getAll("images").length, 2);
  assert.deepEqual(JSON.parse(String(formData.get("imageContexts"))), [
    { role: "front", purpose: "primary" },
    { role: "side", purpose: "reference" },
  ]);
  assert.equal(formData.get("goal"), draft.brief.goal);
  assert.equal(formData.get("explicitChanges"), "Покрасить стены фасада в белый цвет");
  assert.deepEqual(JSON.parse(String(formData.get("mustKeep"))), draft.brief.mustKeep);
  assert.deepEqual(JSON.parse(String(formData.get("mayChange"))), draft.brief.mayChange);
  assert.equal(formData.get("mode"), "fast");
  assert.equal(formData.get("variantCount"), "1");
  assert.equal(formData.get("autoReview"), "false");
});

test("starting generation later never recreates the project — the existing draft id flows through the whole attempt", async () => {
  const draft = storedDraft();
  const attempts: Array<{ projectId: string; attemptId: string }> = [];
  const imageBase64 = Buffer.from([9, 9, 9]).toString("base64");

  const result = await requestAndDecodeConcepts(
    {
      // Exactly how useLocalConceptGeneration wires it: no draft-creation dependency exists on this path.
      persistDraft: async () => draft.id,
      persistAttempt: async (projectId, attemptId) => {
        attempts.push({ projectId, attemptId });
      },
      requestGeneration: async () =>
        new Response(
          JSON.stringify({ variants: [{ status: "succeeded", mode: "fast", mimeType: "image/png", imageBase64, warnings: [] }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    },
    new AbortController().signal,
  );

  assert.equal(result.projectId, draft.id, "the attempt is billed against the already saved draft");
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].projectId, draft.id, "the pre-dispatch attempt record targets the existing draft");
  assert.equal(result.decoded.length, 1);
});
