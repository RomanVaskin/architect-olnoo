import { test } from "node:test";
import assert from "node:assert/strict";
import { CloudGenerationRequestError, requestCloudCorrection, requestCloudGeneration } from "./cloud-generation-client";

function withFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

test("requestCloudGeneration returns the parsed body for any status-bearing response, including a non-2xx one", async () => {
  const result = await withFetch(
    async () => new Response(JSON.stringify({ status: "failed", attemptKey: "a-1", requiresAcknowledgement: false, error: { code: "validation", message: "bad" } }), { status: 422 }),
    () => requestCloudGeneration("p-1", { attemptKey: "a-1", mode: "balanced", autoReview: true }),
  );
  assert.equal(result.status, "failed");
});

test("requestCloudGeneration throws CloudGenerationRequestError for a plain {error} response, mapping its code/message through", async () => {
  await assert.rejects(
    withFetch(
      async () => new Response(JSON.stringify({ error: { code: "not-found", message: "Проект не найден." } }), { status: 404 }),
      () => requestCloudGeneration("p-1", { attemptKey: "a-1", mode: "balanced", autoReview: true }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof CloudGenerationRequestError);
      assert.equal(error.code, "not-found");
      assert.equal(error.requiresAcknowledgement, false);
      return true;
    },
  );
});

test("requestCloudGeneration marks ambiguous-attempt as requiring acknowledgement", async () => {
  await assert.rejects(
    withFetch(
      async () => new Response(JSON.stringify({ error: { code: "ambiguous-attempt", message: "unknown outcome" } }), { status: 409 }),
      () => requestCloudGeneration("p-1", { attemptKey: "a-1", mode: "balanced", autoReview: true }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof CloudGenerationRequestError);
      assert.equal(error.requiresAcknowledgement, true);
      return true;
    },
  );
});

test("requestCloudGeneration treats a network failure as requiring acknowledgement (billing status genuinely unknown)", async () => {
  await assert.rejects(
    withFetch(
      async () => {
        throw new TypeError("network down");
      },
      () => requestCloudGeneration("p-1", { attemptKey: "a-1", mode: "balanced", autoReview: true }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof CloudGenerationRequestError);
      assert.equal(error.code, "network-error");
      assert.equal(error.requiresAcknowledgement, true);
      return true;
    },
  );
});

test("requestCloudCorrection posts to the concept-scoped correct endpoint", async () => {
  let capturedUrl: string | undefined;
  const result = await withFetch(
    async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ status: "succeeded", attemptKey: "a-1", concept: { conceptId: "c-2", imageUrl: "https://x" } }), { status: 200 });
    },
    () => requestCloudCorrection("p-1", "c-1", { attemptKey: "a-1", mode: "balanced" }),
  );
  assert.equal(capturedUrl, "/api/projects/p-1/concepts/c-1/correct");
  assert.equal(result.status, "succeeded");
});
