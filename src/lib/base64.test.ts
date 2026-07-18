import { test } from "node:test";
import assert from "node:assert/strict";
import { base64ToBlob } from "./base64";

test("base64ToBlob decodes a small payload back to the original text", async () => {
  const original = "hello world";
  const base64 = Buffer.from(original, "utf-8").toString("base64");

  const blob = base64ToBlob(base64, "text/plain");

  assert.equal(await blob.text(), original);
  assert.equal(blob.type, "text/plain");
});

test("base64ToBlob decodes payloads spanning multiple chunk boundaries", async () => {
  const original = "x".repeat(50_000);
  const base64 = Buffer.from(original, "utf-8").toString("base64");

  const blob = base64ToBlob(base64, "application/octet-stream", 1024);

  assert.equal(await blob.text(), original);
  assert.equal(blob.size, original.length);
});

test("base64ToBlob preserves binary bytes outside the ASCII range", async () => {
  const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 128, 127]);
  const base64 = Buffer.from(bytes).toString("base64");

  const blob = base64ToBlob(base64, "application/octet-stream");
  const roundTrip = new Uint8Array(await blob.arrayBuffer());

  assert.deepEqual(roundTrip, bytes);
});
