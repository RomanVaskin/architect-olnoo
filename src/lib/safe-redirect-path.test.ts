import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRedirectPath } from "./safe-redirect-path";

test("accepts an ordinary same-origin relative path", () => {
  assert.equal(safeRedirectPath("/projects/local-abc/concepts"), "/projects/local-abc/concepts");
});

test("falls back to / for missing, empty, or non-string values", () => {
  assert.equal(safeRedirectPath(null), "/");
  assert.equal(safeRedirectPath(undefined), "/");
  assert.equal(safeRedirectPath(""), "/");
  assert.equal(safeRedirectPath(new File([], "x")), "/");
});

test("rejects a protocol-relative path (would send the browser off-site)", () => {
  assert.equal(safeRedirectPath("//evil.example/steal"), "/");
});

test("rejects an absolute URL with a scheme", () => {
  assert.equal(safeRedirectPath("https://evil.example"), "/");
  assert.equal(safeRedirectPath("javascript:alert(1)"), "/");
});

test("rejects a backslash trick that some browsers normalize into a protocol-relative URL", () => {
  assert.equal(safeRedirectPath("/\\evil.example"), "/");
  assert.equal(safeRedirectPath("/ok/\\evil.example"), "/");
});

test("rejects an overlong value", () => {
  assert.equal(safeRedirectPath(`/${"a".repeat(2000)}`), "/");
});

test("a custom fallback is used instead of the default /", () => {
  assert.equal(safeRedirectPath(null, "/projects"), "/projects");
});
