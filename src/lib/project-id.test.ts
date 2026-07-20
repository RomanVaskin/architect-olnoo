import { test } from "node:test";
import assert from "node:assert/strict";
import { isDemoProjectId, isLocalProjectId, isServerProjectId } from "./project-id";
import { DEMO_PROJECT_IDS } from "./mock-data";

test("demo ids are recognized and nothing else is", () => {
  for (const id of DEMO_PROJECT_IDS) {
    assert.equal(isDemoProjectId(id), true);
  }
  assert.equal(isDemoProjectId("local-abc"), false);
  assert.equal(isDemoProjectId("11111111-1111-4111-8111-111111111111"), false);
  assert.equal(isDemoProjectId("not-a-real-id"), false);
});

test("local ids are recognized by their local- prefix only", () => {
  assert.equal(isLocalProjectId("local-6b1f1e2a-....."), true);
  assert.equal(isLocalProjectId("11111111-1111-4111-8111-111111111111"), false);
  assert.equal(isLocalProjectId("dom-na-valdae"), false);
});

test("server ids require RFC 4122 UUID shape, not just any id", () => {
  assert.equal(isServerProjectId("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isServerProjectId("11111111-1111-4111-8111-111111111111".toUpperCase()), true);
  assert.equal(isServerProjectId("local-11111111-1111-4111-8111-111111111111"), false);
  assert.equal(isServerProjectId("dom-na-valdae"), false);
  assert.equal(isServerProjectId("not-a-uuid"), false);
  assert.equal(isServerProjectId(""), false);
});

test("the three id spaces never overlap for any real id used in the app", () => {
  const sample = ["local-6b1f1e2a-aaaa-bbbb-cccc-000000000000", "11111111-1111-4111-8111-111111111111", ...DEMO_PROJECT_IDS];
  for (const id of sample) {
    const matches = [isDemoProjectId(id), isLocalProjectId(id), isServerProjectId(id)].filter(Boolean).length;
    assert.equal(matches, 1, `expected exactly one classification for ${id}`);
  }
});
