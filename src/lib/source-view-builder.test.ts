import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSourceRecords } from "./source-view-builder";

const NOW = "2026-07-20T12:00:00+03:00";

test("assigns stable ids and links each view's imageKey to its source file", () => {
  const { sourceFiles, sourceViews } = buildSourceRecords(
    "local-p1",
    NOW,
    [
      { name: "facade.jpg", kind: "photo", hasImage: true, mimeType: "image/jpeg", dimensions: { width: 450, height: 800 } },
      { name: "plan.pdf", kind: "drawing", hasImage: false },
    ],
    [
      { sourceFileIndex: 0, crop: { x: 0, y: 0, width: 450, height: 260 }, order: 0, role: "front", isPrimary: true },
      { sourceFileIndex: 0, crop: { x: 0, y: 266, width: 450, height: 260 }, order: 1, role: "side", isPrimary: false },
    ],
  );

  assert.equal(sourceFiles[0].id, "local-p1-src-0");
  assert.equal(sourceFiles[0].imageKey, "local-p1-src-0:image");
  assert.equal(sourceFiles[0].mimeType, "image/jpeg");
  assert.deepEqual(sourceFiles[0].dimensions, { width: 450, height: 800 });
  assert.equal(sourceFiles[1].imageKey, undefined, "a file with no bytes must not get an imageKey");

  assert.equal(sourceViews.length, 2);
  assert.equal(sourceViews[0].sourceImageId, sourceFiles[0].id);
  assert.equal(sourceViews[0].imageKey, sourceFiles[0].imageKey);
  assert.equal(sourceViews[0].isPrimary, true);
  assert.equal(sourceViews[1].isPrimary, false);
});

test("a project with no confirmed views is valid (photos can be kept as plain materials)", () => {
  const { sourceFiles, sourceViews } = buildSourceRecords(
    "local-p2",
    NOW,
    [{ name: "site.jpg", kind: "photo", hasImage: true, mimeType: "image/jpeg" }],
    [],
  );
  assert.equal(sourceFiles.length, 1);
  assert.deepEqual(sourceViews, []);
});

test("throws if a view references a source file with no stored image", () => {
  assert.throws(
    () =>
      buildSourceRecords(
        "local-p3",
        NOW,
        [{ name: "plan.pdf", kind: "drawing", hasImage: false }],
        [{ sourceFileIndex: 0, crop: { x: 0, y: 0, width: 10, height: 10 }, order: 0, role: "front", isPrimary: true }],
      ),
    /no stored image/,
  );
});

test("throws when zero views are marked primary but at least one view exists", () => {
  assert.throws(
    () =>
      buildSourceRecords(
        "local-p4",
        NOW,
        [{ name: "facade.jpg", kind: "photo", hasImage: true }],
        [{ sourceFileIndex: 0, crop: { x: 0, y: 0, width: 10, height: 10 }, order: 0, role: "front", isPrimary: false }],
      ),
    /Exactly one source view must be marked primary \(found 0\)/,
  );
});

test("throws when more than one view is marked primary", () => {
  assert.throws(
    () =>
      buildSourceRecords(
        "local-p5",
        NOW,
        [{ name: "facade.jpg", kind: "photo", hasImage: true }],
        [
          { sourceFileIndex: 0, crop: { x: 0, y: 0, width: 10, height: 10 }, order: 0, role: "front", isPrimary: true },
          { sourceFileIndex: 0, crop: { x: 0, y: 10, width: 10, height: 10 }, order: 1, role: "side", isPrimary: true },
        ],
      ),
    /Exactly one source view must be marked primary \(found 2\)/,
  );
});

test("out-of-range sourceFileIndex throws instead of silently linking to the wrong file", () => {
  assert.throws(
    () =>
      buildSourceRecords(
        "local-p6",
        NOW,
        [{ name: "facade.jpg", kind: "photo", hasImage: true }],
        [{ sourceFileIndex: 5, crop: { x: 0, y: 0, width: 10, height: 10 }, order: 0, role: "front", isPrimary: true }],
      ),
    /no stored image/,
  );
});
