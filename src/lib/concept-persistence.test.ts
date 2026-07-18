import { test } from "node:test";
import assert from "node:assert/strict";
import { persistConceptsIndividually, type PersistableConcept } from "./concept-persistence";

function makeConcept(key: string): PersistableConcept {
  return {
    key,
    label: `Концепция ${key}`,
    summary: "summary",
    changeExplanation: "change",
    blob: new Blob([key], { type: "image/png" }),
    mimeType: "image/png",
    mode: "auto",
    warnings: [],
  };
}

test("persists each concept individually and reports which ones failed", async () => {
  const persisted: string[] = [];
  const deps = {
    persistConcept: async (_projectId: string, concept: PersistableConcept) => {
      if (concept.key === "b") throw new Error("boom");
      persisted.push(concept.key);
      return `concept-${concept.key}`;
    },
  };

  const concepts = [makeConcept("a"), makeConcept("b"), makeConcept("c")];
  const result = await persistConceptsIndividually(deps, "attempt-1", "project-1", concepts);

  assert.deepEqual(result.persistedKeys, ["a", "c"]);
  assert.deepEqual(result.failedKeys, ["b"]);
  assert.deepEqual(result.conceptIdsByKey, { a: "concept-a", c: "concept-c" });
  assert.deepEqual(persisted, ["a", "c"]);
});

test("generated Blobs remain available after a persistence failure — the caller's concept list is untouched", async () => {
  const deps = {
    persistConcept: async () => {
      throw new Error("indexeddb quota exceeded");
    },
  };

  const concepts = [makeConcept("a"), makeConcept("b")];
  const result = await persistConceptsIndividually(deps, "attempt-1", "project-1", concepts);

  assert.deepEqual(result.persistedKeys, []);
  assert.deepEqual(result.failedKeys, ["a", "b"]);
  // The caller still holds every original Blob — persistence failing must not drop or mutate them.
  assert.equal(concepts.length, 2);
  assert.equal(await concepts[0].blob.text(), "a");
  assert.equal(await concepts[1].blob.text(), "b");
});

test("retrying with only the previously failed concepts performs zero network/API calls", async () => {
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    fetchCalls += 1;
    return originalFetch(...args);
  }) as typeof fetch;

  try {
    let attempt = 0;
    const persisted: string[] = [];
    // deps has no fetch/request field at all — persistConceptsIndividually
    // cannot reach the network even if it wanted to.
    const deps = {
      persistConcept: async (_projectId: string, concept: PersistableConcept) => {
        attempt += 1;
        if (attempt === 1) throw new Error("transient IndexedDB failure");
        persisted.push(concept.key);
        return `concept-${concept.key}`;
      },
    };

    const concepts = [makeConcept("only")];
    const first = await persistConceptsIndividually(deps, "attempt-1", "project-1", concepts);
    assert.deepEqual(first.failedKeys, ["only"]);

    const pending = concepts.filter((concept) => first.failedKeys.includes(concept.key));
    const retry = await persistConceptsIndividually(deps, "attempt-1", "project-1", pending);

    assert.deepEqual(retry.persistedKeys, ["only"]);
    assert.deepEqual(persisted, ["only"]);
    assert.equal(fetchCalls, 0, "retrying persistence must never call fetch");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("onDiagnostic is invoked with the attempt id and stage, never with a raw message assertion required by the caller", async () => {
  const diagnostics: { attemptId: string; stage: string }[] = [];
  const deps = {
    persistConcept: async () => {
      throw new Error("some internal detail");
    },
    onDiagnostic: (attemptId: string, stage: string) => {
      diagnostics.push({ attemptId, stage });
    },
  };

  await persistConceptsIndividually(deps, "attempt-42", "project-1", [makeConcept("x")]);

  assert.deepEqual(diagnostics, [{ attemptId: "attempt-42", stage: "persist-concept" }]);
});
