import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blobToStoredImageRecord,
  storedImageRecordToBlob,
  type StoredImageRecord,
} from "./concept-image-codec";

test("Blob -> ArrayBuffer -> Blob round trip preserves type and content", async () => {
  const original = new Blob(["hello concept image"], { type: "image/png" });

  const record = await blobToStoredImageRecord("project-1:concept-1", original, "image/png");
  assert.ok(record.bytes instanceof ArrayBuffer, "stored record must hold an ArrayBuffer, not a Blob");

  const reconstructed = storedImageRecordToBlob(record);
  assert.ok(reconstructed instanceof Blob);
  assert.equal(reconstructed.type, "image/png");
  assert.equal(await reconstructed.text(), "hello concept image");
});

test("binary bytes (including 0x00 and 0xff) survive the round trip exactly", async () => {
  const bytes = new Uint8Array(256);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i; // covers every byte value 0-255
  const original = new Blob([bytes], { type: "image/webp" });

  const record = await blobToStoredImageRecord("project-2:concept-1", original, "image/webp");
  const reconstructed = storedImageRecordToBlob(record);
  const roundTripped = new Uint8Array(await reconstructed.arrayBuffer());

  assert.equal(roundTripped.length, bytes.length);
  assert.deepEqual(Array.from(roundTripped), Array.from(bytes));
});

test("stored image record is structured-clone-safe (no Blob anywhere in it)", async () => {
  const original = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/jpeg" });
  const record = await blobToStoredImageRecord("project-3:concept-1", original, "image/jpeg");

  // structuredClone throws DataCloneError synchronously if the value (or anything
  // nested in it) isn't cloneable — this is the same check IndexedDB performs.
  const cloned = structuredClone(record);
  assert.deepEqual(Object.keys(cloned).sort(), ["bytes", "imageKey", "mimeType"]);
  assert.ok(cloned.bytes instanceof ArrayBuffer);
  assert.equal(cloned.imageKey, "project-3:concept-1");
  assert.equal(cloned.mimeType, "image/jpeg");
});

test("storedImageRecordToBlob still reads legacy { imageKey, blob } records saved before this fix", () => {
  const legacyBlob = new Blob(["legacy bytes"], { type: "image/png" });
  const legacyRecord = { imageKey: "project-4:concept-1", blob: legacyBlob };

  const blob = storedImageRecordToBlob(legacyRecord);
  assert.equal(blob, legacyBlob);
});

test("blobToStoredImageRecord never produces a legacy-shaped record", async () => {
  const record: StoredImageRecord = await blobToStoredImageRecord("project-5:concept-1", new Blob(["x"]), "image/png");
  assert.equal("blob" in record, false);
});
