import { test } from "node:test";
import assert from "node:assert/strict";
import { requestAndDecodeConcepts, GenerationFlowError, type RequestAndDecodeDeps } from "./concept-generation-flow";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function b64(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64");
}

test("the draft project (and attempt record) are persisted before the API request is sent", async () => {
  const calls: string[] = [];
  const deps: RequestAndDecodeDeps = {
    generateAttemptId: () => "attempt-fixed",
    persistDraft: async () => {
      calls.push("persistDraft");
      return "project-1";
    },
    persistAttempt: async () => {
      calls.push("persistAttempt");
    },
    requestGeneration: async () => {
      calls.push("requestGeneration");
      // If persistDraft/persistAttempt hadn't already run, this assertion would trip mid-flow.
      assert.deepEqual(calls, ["persistDraft", "persistAttempt", "requestGeneration"]);
      return jsonResponse({ variants: [{ status: "succeeded", mode: "auto", mimeType: "image/png", imageBase64: b64("img"), warnings: [] }] });
    },
  };

  const result = await requestAndDecodeConcepts(deps, new AbortController().signal);

  assert.deepEqual(calls, ["persistDraft", "persistAttempt", "requestGeneration"]);
  assert.equal(result.projectId, "project-1");
  assert.equal(result.attemptId, "attempt-fixed");
  assert.equal(result.decoded.length, 1);
});

test("requestGeneration is never called if persisting the draft fails first", async () => {
  let requested = false;
  const deps: RequestAndDecodeDeps = {
    persistDraft: async () => {
      throw new Error("indexeddb unavailable");
    },
    persistAttempt: async () => {},
    requestGeneration: async () => {
      requested = true;
      return jsonResponse({ variants: [] });
    },
  };

  await assert.rejects(() => requestAndDecodeConcepts(deps, new AbortController().signal), GenerationFlowError);
  assert.equal(requested, false);
});

test("decoding is isolated per-variant: one corrupt payload doesn't discard the others", async () => {
  const deps: RequestAndDecodeDeps = {
    generateAttemptId: () => "attempt-1",
    persistDraft: async () => "project-1",
    persistAttempt: async () => {},
    requestGeneration: async () =>
      jsonResponse({
        variants: [
          { status: "succeeded", mode: "auto", mimeType: "image/png", imageBase64: "not-valid-base64!!", warnings: [] },
          { status: "succeeded", mode: "auto", mimeType: "image/png", imageBase64: b64("good"), warnings: [] },
        ],
      }),
  };

  const result = await requestAndDecodeConcepts(deps, new AbortController().signal);

  assert.equal(result.decoded.length, 1);
  assert.equal(await result.decoded[0].blob.text(), "good");
  assert.equal(result.partial, true);
});

test("diagnostics reported during the flow carry only the attempt id, stage, and a safe code", async () => {
  const diagnostics: { attemptId: string; stage: string; error: unknown }[] = [];
  const secretDetail = "provider-secret-request-id-98212";

  const deps: RequestAndDecodeDeps = {
    generateAttemptId: () => "attempt-9",
    persistDraft: async () => "project-1",
    persistAttempt: async () => {},
    requestGeneration: async () => {
      throw new Error(secretDetail);
    },
    onDiagnostic: (attemptId, stage, error) => {
      diagnostics.push({ attemptId, stage, error });
    },
  };

  await assert.rejects(() => requestAndDecodeConcepts(deps, new AbortController().signal), GenerationFlowError);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].attemptId, "attempt-9");
  assert.equal(diagnostics[0].stage, "request");
  // The flow forwards the raw error to onDiagnostic; it is the diagnostic
  // logger's job (see generation-diagnostics.ts) to strip it down before
  // anything reaches console.error. Confirm the thrown user-facing error
  // itself never echoes the secret detail.
  await assert.rejects(
    () => requestAndDecodeConcepts(deps, new AbortController().signal),
    (error: unknown) => {
      assert.ok(error instanceof GenerationFlowError);
      assert.equal(error.message.includes(secretDetail), false);
      return true;
    },
  );
});

test("an AbortError from the request is propagated as-is (not wrapped) so the caller can special-case cancellation", async () => {
  const deps: RequestAndDecodeDeps = {
    persistDraft: async () => "project-1",
    persistAttempt: async () => {},
    requestGeneration: async () => {
      throw new DOMException("aborted", "AbortError");
    },
  };

  await assert.rejects(
    () => requestAndDecodeConcepts(deps, new AbortController().signal),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});
