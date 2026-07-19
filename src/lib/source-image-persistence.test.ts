import { test } from "node:test";
import assert from "node:assert/strict";
import { blobToStoredImageRecord, storedImageRecordToBlob } from "./concept-image-codec";

/**
 * Source-image bytes are written to IndexedDB with the same structured-clone-safe
 * { imageKey, bytes: ArrayBuffer, mimeType } shape already proven for generated
 * concept images (see concept-image-codec.ts / CHANGELOG — storing a raw Blob
 * threw DataCloneError in production). These tests exercise that same codec
 * against a source-image-sized payload to confirm original source bytes survive
 * the round trip exactly, with no re-encoding or silent modification.
 *
 * No image file was supplied with this task, so the required 450×800
 * verification fixture is synthesized here as a deterministic raw RGBA buffer
 * (450 * 800 * 4 bytes) rather than assumed.
 */

function synthetic450x800Bytes(): Uint8Array<ArrayBuffer> {
  const width = 450;
  const height = 800;
  const bytes = new Uint8Array(width * height * 4);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256; // deterministic, covers every byte value repeatedly
  return bytes;
}

test("a 450x800 source image's bytes survive Blob -> ArrayBuffer -> Blob exactly", async () => {
  const originalBytes = synthetic450x800Bytes();
  const original = new Blob([originalBytes], { type: "image/png" });

  const record = await blobToStoredImageRecord("local-p1-src-0:image", original, "image/png");
  assert.ok(record.bytes instanceof ArrayBuffer, "must store an ArrayBuffer, never a Blob");
  assert.equal(record.bytes.byteLength, originalBytes.length);

  const reconstructed = storedImageRecordToBlob(record);
  const roundTripped = new Uint8Array(await reconstructed.arrayBuffer());

  assert.equal(roundTripped.length, originalBytes.length);
  assert.deepEqual(Array.from(roundTripped), Array.from(originalBytes));
  assert.equal(reconstructed.type, "image/png");
});

test("the stored source-image record is structured-clone-safe (no Blob/File anywhere in it)", async () => {
  const original = new Blob([synthetic450x800Bytes()], { type: "image/jpeg" });
  const record = await blobToStoredImageRecord("local-p2-src-0:image", original, "image/jpeg");

  // structuredClone throws DataCloneError synchronously on anything not
  // cloneable — the same check IndexedDB performs when the record is written.
  const cloned = structuredClone(record);
  assert.deepEqual(Object.keys(cloned).sort(), ["bytes", "imageKey", "mimeType"]);
  assert.ok(cloned.bytes instanceof ArrayBuffer);
});

test("binary edge-case byte values (0x00 and 0xff) survive the round trip", async () => {
  const bytes = new Uint8Array(512);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i < 256 ? i : 255 - (i - 256);
  const original = new Blob([bytes], { type: "image/webp" });

  const record = await blobToStoredImageRecord("local-p3-src-0:image", original, "image/webp");
  const reconstructed = storedImageRecordToBlob(record);
  const roundTripped = new Uint8Array(await reconstructed.arrayBuffer());

  assert.deepEqual(Array.from(roundTripped), Array.from(bytes));
});
