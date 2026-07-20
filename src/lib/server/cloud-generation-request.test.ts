import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCloudCorrectBody, parseCloudGenerateBody } from "./cloud-generation-request";

const VALID_KEY = "a1b2c3d4-e5f6-4789-a123-1234567890ab";

test("parseCloudGenerateBody accepts a well-formed body", () => {
  const parsed = parseCloudGenerateBody({ attemptKey: VALID_KEY, mode: "balanced", autoReview: true });
  assert.deepEqual(parsed, { attemptKey: VALID_KEY, mode: "balanced", autoReview: true, retryImageBase64: undefined, retryMimeType: undefined });
});

test("parseCloudGenerateBody rejects a non-UUID attemptKey — it becomes a Storage path segment, so it must be validated", () => {
  assert.equal(parseCloudGenerateBody({ attemptKey: "../../etc/passwd", mode: "balanced", autoReview: true }), null);
});

test("parseCloudGenerateBody rejects an unknown generation mode", () => {
  assert.equal(parseCloudGenerateBody({ attemptKey: VALID_KEY, mode: "ultra", autoReview: true }), null);
});

test("parseCloudGenerateBody rejects a non-boolean autoReview", () => {
  assert.equal(parseCloudGenerateBody({ attemptKey: VALID_KEY, mode: "balanced", autoReview: "true" }), null);
});

test("parseCloudGenerateBody rejects a retryMimeType outside the accepted image set", () => {
  assert.equal(
    parseCloudGenerateBody({ attemptKey: VALID_KEY, mode: "balanced", autoReview: true, retryImageBase64: "abc", retryMimeType: "application/pdf" }),
    null,
  );
});

test("parseCloudGenerateBody accepts valid retry fields", () => {
  const parsed = parseCloudGenerateBody({ attemptKey: VALID_KEY, mode: "fast", autoReview: false, retryImageBase64: "abc", retryMimeType: "image/png" });
  assert.equal(parsed?.retryImageBase64, "abc");
  assert.equal(parsed?.retryMimeType, "image/png");
});

test("parseCloudGenerateBody rejects a non-object body", () => {
  assert.equal(parseCloudGenerateBody(null), null);
  assert.equal(parseCloudGenerateBody("string"), null);
  assert.equal(parseCloudGenerateBody([1, 2]), null);
});

test("parseCloudCorrectBody accepts a well-formed body without autoReview (correction always reviews)", () => {
  const parsed = parseCloudCorrectBody({ attemptKey: VALID_KEY, mode: "maximum-quality" });
  assert.deepEqual(parsed, { attemptKey: VALID_KEY, mode: "maximum-quality", retryImageBase64: undefined, retryMimeType: undefined });
});

test("parseCloudCorrectBody rejects a missing attemptKey", () => {
  assert.equal(parseCloudCorrectBody({ mode: "balanced" }), null);
});
