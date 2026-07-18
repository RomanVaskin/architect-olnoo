import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_GENERATION_IMAGES,
  fileKey,
  isRasterImage,
  reconcileGenerationSelection,
  toggleGenerationSelection,
} from "./wizard-generation-selection";

function photo(name: string, size = 1024) {
  return { name, size, type: "image/jpeg" };
}
function pdf(name: string, size = 1024) {
  return { name, size, type: "application/pdf" };
}

test("isRasterImage distinguishes photos from PDFs", () => {
  assert.equal(isRasterImage(photo("a.jpg")), true);
  assert.equal(isRasterImage(pdf("a.pdf")), false);
});

test("reconcileGenerationSelection auto-selects only the first MAX_GENERATION_IMAGES raster files", () => {
  const files = [photo("a.jpg"), photo("b.jpg"), photo("c.jpg"), photo("d.jpg"), photo("e.jpg")];
  const selection = reconcileGenerationSelection(files, []);
  assert.equal(selection.length, MAX_GENERATION_IMAGES);
  assert.deepEqual(selection, [fileKey(files[0]), fileKey(files[1]), fileKey(files[2])]);
});

test("reconcileGenerationSelection never selects PDFs, regardless of order", () => {
  const files = [pdf("plan.pdf"), photo("a.jpg"), photo("b.jpg")];
  const selection = reconcileGenerationSelection(files, []);
  assert.equal(selection.includes(fileKey(files[0])), false);
  assert.deepEqual(selection.sort(), [fileKey(files[1]), fileKey(files[2])].sort());
});

test("reconcileGenerationSelection keeps a manual selection when more rasters are added later", () => {
  const initialFiles = [photo("a.jpg"), photo("b.jpg"), photo("c.jpg"), photo("d.jpg")];
  const manualSelection = [fileKey(initialFiles[3])]; // user manually kept only "d.jpg" selected
  const afterAddingMore = [...initialFiles, photo("e.jpg")];

  const selection = reconcileGenerationSelection(afterAddingMore, manualSelection);
  // Already at/above the cap relative to the kept selection plus available slots is not the case here
  // (only 1 kept, cap is 3), so it should top up with newly-available files, keeping "d.jpg".
  assert.ok(selection.includes(fileKey(initialFiles[3])));
  assert.equal(selection.length, MAX_GENERATION_IMAGES);
});

test("reconcileGenerationSelection drops a selected key once its file is removed", () => {
  const files = [photo("a.jpg"), photo("b.jpg")];
  const selection = reconcileGenerationSelection(files, [fileKey(files[0]), fileKey(files[1]), "stale-key"]);
  assert.deepEqual(selection.sort(), [fileKey(files[0]), fileKey(files[1])].sort());
});

test("toggleGenerationSelection removes an already-selected key", () => {
  const result = toggleGenerationSelection(["a", "b"], "a");
  assert.deepEqual(result, ["b"]);
});

test("toggleGenerationSelection adds a key when under the cap", () => {
  const result = toggleGenerationSelection(["a"], "b");
  assert.deepEqual(result, ["a", "b"]);
});

test("toggleGenerationSelection refuses to add a key past MAX_GENERATION_IMAGES", () => {
  const atCap = ["a", "b", "c"];
  assert.equal(atCap.length, MAX_GENERATION_IMAGES);
  const result = toggleGenerationSelection(atCap, "d");
  assert.deepEqual(result, atCap);
});
