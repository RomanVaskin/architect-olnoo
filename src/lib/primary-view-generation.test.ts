import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConceptSourceProvenance, prepareGenerationViews, preparePrimaryViewForGeneration } from "./primary-view-generation";

function makeFile(name = "house.jpg", type = "image/jpeg"): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type, lastModified: 123 });
}

test("crops the one Primary View and returns the exact File used for preview and request", async () => {
  const source = makeFile();
  let cropCalls = 0;
  const prepared = await preparePrimaryViewForGeneration(
    [source],
    [
      { fileKey: `${source.name}-${source.size}`, crop: { x: 0, y: 300, width: 450, height: 250 }, order: 1, role: "front", isPrimary: true },
    ],
    { [`${source.name}-${source.size}`]: { width: 450, height: 800 } },
    async (_blob, crop, mimeType) => {
      cropCalls += 1;
      assert.deepEqual(crop, { x: 0, y: 300, width: 450, height: 250 });
      return new Blob([new Uint8Array([9, 8, 7])], { type: mimeType });
    },
  );

  assert.equal(cropCalls, 1);
  assert.equal(prepared.file.name, "house-primary-view.jpg");
  assert.equal(prepared.file.size, 3);
  assert.deepEqual(prepared.dimensions, { width: 450, height: 250 });
  assert.equal(prepared.sourceFileIndex, 0);
  assert.equal(prepared.sourceViewIndex, 0);
});

test("reuses original bytes for a full-frame Primary View without re-encoding", async () => {
  const source = makeFile("facade.webp", "image/webp");
  const prepared = await preparePrimaryViewForGeneration(
    [source],
    [
      { fileKey: `${source.name}-${source.size}`, crop: { x: 0, y: 0, width: 1200, height: 800 }, order: 0, role: "front", isPrimary: true },
    ],
    { [`${source.name}-${source.size}`]: { width: 1200, height: 800 } },
    async () => {
      throw new Error("cropper must not be called for a full frame");
    },
  );

  assert.equal(prepared.file, source);
  assert.equal(prepared.payloadSizeBytes, source.size);
});

test("rejects missing, duplicate, and out-of-bounds Primary Views before any paid request", async () => {
  const source = makeFile();
  const key = `${source.name}-${source.size}`;
  const dimensions = { [key]: { width: 450, height: 800 } };

  await assert.rejects(() => preparePrimaryViewForGeneration([source], [], dimensions), /ровно один основной ракурс/);
  await assert.rejects(
    () =>
      preparePrimaryViewForGeneration(
        [source],
        [
          { fileKey: key, crop: { x: 0, y: 0, width: 450, height: 200 }, order: 0, role: "front", isPrimary: true },
          { fileKey: key, crop: { x: 0, y: 200, width: 450, height: 200 }, order: 1, role: "side", isPrimary: true },
        ],
        dimensions,
      ),
    /найдено: 2/,
  );
  await assert.rejects(
    () =>
      preparePrimaryViewForGeneration(
        [source],
        [{ fileKey: key, crop: { x: 0, y: 700, width: 450, height: 200 }, order: 0, role: "front", isPrimary: true }],
        dimensions,
      ),
    /выходит за границы/,
  );
});

test("builds stable concept provenance linked to the persisted source file and view", async () => {
  const source = makeFile();
  const key = `${source.name}-${source.size}`;
  const prepared = await preparePrimaryViewForGeneration(
    [source],
    [{ fileKey: key, crop: { x: 0, y: 200, width: 450, height: 250 }, order: 2, role: "rear", isPrimary: true }],
    { [key]: { width: 450, height: 800 } },
    async (_blob, _crop, mimeType) => new Blob([new Uint8Array([5, 6])], { type: mimeType }),
  );

  assert.deepEqual(buildConceptSourceProvenance("local-p1", prepared), {
    sourceFileId: "local-p1-src-0",
    sourceViewId: "local-p1-view-0",
    sourceFileName: "house.jpg",
    role: "rear",
    crop: { x: 0, y: 200, width: 450, height: 250 },
    payload: { mimeType: "image/jpeg", width: 450, height: 250, sizeBytes: 2 },
  });
});

test("prepares primary first plus at most two ordered reference views", async () => {
  const source = makeFile();
  const key = `${source.name}-${source.size}`;
  const prepared = await prepareGenerationViews(
    [source],
    [
      { fileKey: key, crop: { x: 0, y: 600, width: 450, height: 200 }, order: 3, role: "detail", isPrimary: false },
      { fileKey: key, crop: { x: 0, y: 0, width: 450, height: 200 }, order: 0, role: "front", isPrimary: true },
      { fileKey: key, crop: { x: 0, y: 400, width: 450, height: 200 }, order: 2, role: "rear", isPrimary: false },
      { fileKey: key, crop: { x: 0, y: 200, width: 450, height: 200 }, order: 1, role: "side", isPrimary: false },
    ],
    { [key]: { width: 450, height: 800 } },
    async (_blob, crop, mimeType) => new Blob([new Uint8Array([crop.y / 200])], { type: mimeType }),
  );

  assert.equal(prepared.views.length, 3);
  assert.deepEqual(prepared.views.map((view) => ({ role: view.role, isPrimary: view.isPrimary })), [
    { role: "front", isPrimary: true },
    { role: "side", isPrimary: false },
    { role: "rear", isPrimary: false },
  ]);
  assert.equal(prepared.totalPayloadSizeBytes, 3);

  const provenance = buildConceptSourceProvenance("local-p2", prepared.views[0], prepared.views.slice(1));
  assert.deepEqual(provenance.referenceViews?.map((view) => view.role), ["side", "rear"]);
});
