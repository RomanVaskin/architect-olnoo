import { test } from "node:test";
import assert from "node:assert/strict";
import { detectCollageViews, type PixelBuffer } from "./collage-detector";

/**
 * No image file was supplied with this task, so the 450×800 fixture required
 * for local verification (see CHANGELOG / task notes) is synthesized here
 * deterministically — a three-panel vertical collage at that exact
 * resolution — rather than assumed. Rows are built from explicit alternating
 * two-value patterns (never random) so every stddev/mean used in the
 * assertions below is exact, not sampled.
 */

function solidRow(width: number, value: number): number[] {
  return new Array(width).fill(value);
}

/** Deterministic "photo content" row: exact mean (v1+v2)/2, exact stdDev |v1-v2|/2 for an even width. */
function alternatingRow(width: number, v1: number, v2: number): number[] {
  return Array.from({ length: width }, (_, x) => (x % 2 === 0 ? v1 : v2));
}

function buildPixelBuffer(width: number, rows: number[][]): PixelBuffer {
  const height = rows.length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => {
    row.forEach((value, x) => {
      const i = (y * width + x) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    });
  });
  return { width, height, data };
}

function threePanelCollage450x800(): PixelBuffer {
  const width = 450;
  const rows: number[][] = [];
  for (let i = 0; i < 260; i++) rows.push(alternatingRow(width, 20, 180)); // panel 1: rows 0-259
  for (let i = 0; i < 6; i++) rows.push(solidRow(width, 250)); // separator: rows 260-265
  for (let i = 0; i < 260; i++) rows.push(alternatingRow(width, 20, 180)); // panel 2: rows 266-525
  for (let i = 0; i < 6; i++) rows.push(solidRow(width, 250)); // separator: rows 526-531
  for (let i = 0; i < 268; i++) rows.push(alternatingRow(width, 20, 180)); // panel 3: rows 532-799
  assert.equal(rows.length, 800);
  return buildPixelBuffer(width, rows);
}

test("450x800 three-panel vertical collage is split into three views with high confidence", () => {
  const pixels = threePanelCollage450x800();
  const result = detectCollageViews(pixels);

  assert.equal(result.isFallback, false);
  assert.equal(result.views.length, 3);
  assert.ok(result.confidence > 0.9, `expected high confidence, got ${result.confidence}`);
  for (const view of result.views) assert.ok(view.confidence > 0.9);
});

test("crop-boundary correctness: panel rectangles are exact, non-overlapping, and span the full image", () => {
  const pixels = threePanelCollage450x800();
  const result = detectCollageViews(pixels);

  assert.deepEqual(result.views[0].crop, { x: 0, y: 0, width: 450, height: 260 });
  assert.deepEqual(result.views[1].crop, { x: 0, y: 266, width: 450, height: 260 });
  assert.deepEqual(result.views[2].crop, { x: 0, y: 532, width: 450, height: 268 });

  // No overlap, no gap beyond the separator bands, and the panels plus the two
  // 6px separators account for every one of the 800 rows.
  const separatorRows = 800 - result.views.reduce((sum, v) => sum + v.crop.height, 0);
  assert.equal(separatorRows, 12);
  assert.equal(result.views[0].crop.y + result.views[0].crop.height, 260);
  assert.equal(result.views[1].crop.y, 266);
  assert.equal(result.views[1].crop.y + result.views[1].crop.height, 526);
  assert.equal(result.views[2].crop.y, 532);
  assert.equal(result.views[2].crop.y + result.views[2].crop.height, 800);
});

test("a normal single (non-collage) image falls back to one full-image view", () => {
  const width = 450;
  const rows: number[][] = [];
  for (let i = 0; i < 800; i++) rows.push(alternatingRow(width, 20, 180));
  const pixels = buildPixelBuffer(width, rows);

  const result = detectCollageViews(pixels);

  assert.equal(result.isFallback, true);
  assert.equal(result.views.length, 1);
  assert.deepEqual(result.views[0].crop, { x: 0, y: 0, width: 450, height: 800 });
  assert.equal(result.confidence, 1);
});

test("weak/ambiguous separator band falls back to one view instead of forcing a low-confidence split", () => {
  const width = 450;
  const rows: number[][] = [];
  for (let i = 0; i < 90; i++) rows.push(alternatingRow(width, 27, 227)); // content: mean 127, stdDev 100
  for (let i = 0; i < 3; i++) rows.push(alternatingRow(width, 100, 118)); // borderline band: mean 109, stdDev 9
  for (let i = 0; i < 107; i++) rows.push(alternatingRow(width, 27, 227));
  assert.equal(rows.length, 200);
  const pixels = buildPixelBuffer(width, rows);

  const result = detectCollageViews(pixels);

  assert.equal(result.isFallback, true);
  assert.equal(result.views.length, 1);
  assert.deepEqual(result.views[0].crop, { x: 0, y: 0, width: 450, height: 200 });
  // Falls back specifically because confidence was insufficient (a candidate band
  // was found), not because no band existed at all — confidence must stay below
  // the acceptance threshold rather than snapping to the "no bands" value of 1.
  assert.ok(result.confidence < 0.55, `expected low confidence, got ${result.confidence}`);
});

test("never modifies the pixel buffer it was given", () => {
  const pixels = threePanelCollage450x800();
  const before = Uint8ClampedArray.from(pixels.data);

  detectCollageViews(pixels);

  assert.deepEqual(Array.from(pixels.data), Array.from(before));
});

test("throws on a malformed buffer instead of silently reading out of bounds", () => {
  const badPixels: PixelBuffer = { width: 10, height: 10, data: new Uint8ClampedArray(10) };
  assert.throws(() => detectCollageViews(badPixels));
});
