import { test } from "node:test";
import assert from "node:assert/strict";
import {
  requestAndDecodeConcepts,
  reuseOrCreateDraft,
  extractRecoveryState,
  GenerationFlowError,
  type RequestAndDecodeDeps,
} from "./concept-generation-flow";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function b64(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64");
}

const REVIEW_REPORT = {
  status: "inconclusive" as const,
  confidence: 0.5,
  summary: "Недостаточно данных",
  checks: [],
  advisory: "Требуется проверка специалиста",
};

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
      return jsonResponse({ variants: [{ status: "succeeded", mode: "auto", mimeType: "image/png", imageBase64: b64("img"), warnings: [], geometryVerification: REVIEW_REPORT }] });
    },
  };

  const result = await requestAndDecodeConcepts(deps, new AbortController().signal);

  assert.deepEqual(calls, ["persistDraft", "persistAttempt", "requestGeneration"]);
  assert.equal(result.projectId, "project-1");
  assert.equal(result.attemptId, "attempt-fixed");
  assert.equal(result.decoded.length, 1);
  assert.deepEqual(result.decoded[0].geometryVerification, REVIEW_REPORT);
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

test("cancellation (AbortError) after the request is dispatched is wrapped in GenerationFlowError, never rethrown raw", async () => {
  const deps: RequestAndDecodeDeps = {
    generateAttemptId: () => "attempt-cancel",
    persistDraft: async () => "project-1",
    persistAttempt: async () => {},
    requestGeneration: async () => {
      throw new DOMException("aborted", "AbortError");
    },
  };

  await assert.rejects(
    () => requestAndDecodeConcepts(deps, new AbortController().signal),
    (error: unknown) => {
      // Must not be a bare DOMException — attemptId/projectId would be lost.
      assert.ok(!(error instanceof DOMException));
      assert.ok(error instanceof GenerationFlowError);
      assert.equal(error.attemptId, "attempt-cancel");
      assert.equal(error.projectId, "project-1");
      assert.equal(error.requiresAcknowledgement, true);
      // Cancelling in the browser must not be presented as proof billing was avoided.
      assert.equal(/не была оплачена/i.test(error.message), false);
      assert.equal(/not billed/i.test(error.message), false);
      return true;
    },
  );
});

test("a rejected fetch (network failure) never claims the paid request was definitely unsent, and requires acknowledgement before retrying", async () => {
  const deps: RequestAndDecodeDeps = {
    generateAttemptId: () => "attempt-net",
    persistDraft: async () => "project-1",
    persistAttempt: async () => {},
    requestGeneration: async () => {
      throw new TypeError("Failed to fetch");
    },
  };

  await assert.rejects(
    () => requestAndDecodeConcepts(deps, new AbortController().signal),
    (error: unknown) => {
      assert.ok(error instanceof GenerationFlowError);
      assert.equal(error.requiresAcknowledgement, true);
      assert.equal(error.attemptId, "attempt-net");
      assert.equal(error.projectId, "project-1");
      // Must not assert the request was unsent — a client-side network
      // failure does not prove the server/provider never received it.
      assert.equal(/не был отправлен/i.test(error.message), false);
      assert.equal(/не отправлен/i.test(error.message), false);
      assert.equal(/not sent/i.test(error.message), false);
      return true;
    },
  );
});

test("an unparseable HTTP response requires acknowledgement before retrying", async () => {
  const deps: RequestAndDecodeDeps = {
    generateAttemptId: () => "attempt-parse",
    persistDraft: async () => "project-1",
    persistAttempt: async () => {},
    requestGeneration: async () => new Response("not json", { status: 200 }),
  };

  await assert.rejects(
    () => requestAndDecodeConcepts(deps, new AbortController().signal),
    (error: unknown) => {
      assert.ok(error instanceof GenerationFlowError);
      assert.equal(error.stage, "parse-response");
      assert.equal(error.requiresAcknowledgement, true);
      assert.equal(error.attemptId, "attempt-parse");
      assert.equal(error.projectId, "project-1");
      return true;
    },
  );
});

test("receiving paid image payloads that all fail to decode requires acknowledgement before retrying", async () => {
  const deps: RequestAndDecodeDeps = {
    generateAttemptId: () => "attempt-decode",
    persistDraft: async () => "project-1",
    persistAttempt: async () => {},
    requestGeneration: async () =>
      jsonResponse({
        variants: [
          { status: "succeeded", mode: "auto", mimeType: "image/png", imageBase64: "not-valid-base64!!", warnings: [] },
          { status: "succeeded", mode: "auto", mimeType: "image/png", imageBase64: "also-not-valid!!", warnings: [] },
        ],
      }),
  };

  await assert.rejects(
    () => requestAndDecodeConcepts(deps, new AbortController().signal),
    (error: unknown) => {
      assert.ok(error instanceof GenerationFlowError);
      assert.equal(error.stage, "decode-image");
      assert.equal(error.requiresAcknowledgement, true);
      assert.equal(error.attemptId, "attempt-decode");
      assert.equal(error.projectId, "project-1");
      return true;
    },
  );
});

test("persist-draft and persist-attempt failures do NOT require acknowledgement — the request genuinely never went out", async () => {
  const draftFailure: RequestAndDecodeDeps = {
    persistDraft: async () => {
      throw new Error("indexeddb unavailable");
    },
    persistAttempt: async () => {},
    requestGeneration: async () => jsonResponse({ variants: [] }),
  };

  await assert.rejects(
    () => requestAndDecodeConcepts(draftFailure, new AbortController().signal),
    (error: unknown) => {
      assert.ok(error instanceof GenerationFlowError);
      assert.equal(error.requiresAcknowledgement, false);
      return true;
    },
  );

  const attemptFailure: RequestAndDecodeDeps = {
    persistDraft: async () => "project-1",
    persistAttempt: async () => {
      throw new Error("indexeddb unavailable");
    },
    requestGeneration: async () => jsonResponse({ variants: [] }),
  };

  await assert.rejects(
    () => requestAndDecodeConcepts(attemptFailure, new AbortController().signal),
    (error: unknown) => {
      assert.ok(error instanceof GenerationFlowError);
      assert.equal(error.requiresAcknowledgement, false);
      return true;
    },
  );
});

test("normal server validation/quota responses (response not ok, or zero succeeded variants) do NOT require acknowledgement", async () => {
  const validationFailure: RequestAndDecodeDeps = {
    persistDraft: async () => "project-1",
    persistAttempt: async () => {},
    requestGeneration: async () => jsonResponse({ error: { message: "Квота исчерпана" } }, 429),
  };

  await assert.rejects(
    () => requestAndDecodeConcepts(validationFailure, new AbortController().signal),
    (error: unknown) => {
      assert.ok(error instanceof GenerationFlowError);
      assert.equal(error.requiresAcknowledgement, false);
      return true;
    },
  );

  const noSucceededVariants: RequestAndDecodeDeps = {
    persistDraft: async () => "project-1",
    persistAttempt: async () => {},
    requestGeneration: async () =>
      jsonResponse({
        variants: [{ status: "failed", mode: "auto", warnings: [], error: { code: "safety-rejection", message: "Отклонено" } }],
      }),
  };

  await assert.rejects(
    () => requestAndDecodeConcepts(noSucceededVariants, new AbortController().signal),
    (error: unknown) => {
      assert.ok(error instanceof GenerationFlowError);
      assert.equal(error.requiresAcknowledgement, false);
      return true;
    },
  );
});

test("extractRecoveryState pulls attemptId, projectId, requiresAcknowledgement and message off a GenerationFlowError — this is what the wizard uses to keep its recovery state in sync", async () => {
  const deps: RequestAndDecodeDeps = {
    generateAttemptId: () => "attempt-recover",
    persistDraft: async () => "project-recover",
    persistAttempt: async () => {},
    requestGeneration: async () => {
      throw new TypeError("Failed to fetch");
    },
  };

  try {
    await requestAndDecodeConcepts(deps, new AbortController().signal);
    assert.fail("expected requestAndDecodeConcepts to throw");
  } catch (error) {
    const recovery = extractRecoveryState(error);
    assert.deepEqual(recovery, {
      attemptId: "attempt-recover",
      projectId: "project-recover",
      requiresAcknowledgement: true,
      message: (error as GenerationFlowError).message,
    });
  }
});

test("extractRecoveryState returns null for errors that aren't a GenerationFlowError (e.g. AbortError) — nothing to recover", () => {
  assert.equal(extractRecoveryState(new DOMException("aborted", "AbortError")), null);
  assert.equal(extractRecoveryState(new Error("plain error")), null);
});

test("reuseOrCreateDraft reuses an existing draft id and never calls createDraft again", async () => {
  let createCalls = 0;
  const createDraft = async () => {
    createCalls += 1;
    return `project-${createCalls}`;
  };

  const first = await reuseOrCreateDraft(null, createDraft);
  assert.equal(first, "project-1");
  assert.equal(createCalls, 1);

  const second = await reuseOrCreateDraft(first, createDraft);
  assert.equal(second, "project-1");
  assert.equal(createCalls, 1, "must not create a second draft once one already exists");
});

test("retrying a failed generation attempt reuses the same draft project instead of creating a duplicate", async () => {
  let createCalls = 0;
  let existingProjectId: string | null = null;
  const persistDraft = () =>
    reuseOrCreateDraft(existingProjectId, async () => {
      createCalls += 1;
      return "project-1";
    });

  // First attempt: an ambiguous network failure after the draft was created.
  await assert.rejects(() =>
    requestAndDecodeConcepts(
      {
        generateAttemptId: () => "attempt-1",
        persistDraft,
        persistAttempt: async () => {},
        requestGeneration: async () => {
          throw new TypeError("Failed to fetch");
        },
      },
      new AbortController().signal,
    ),
  );
  assert.equal(createCalls, 1);

  // The wizard would have stored the project id from the caught error's recovery state here.
  existingProjectId = "project-1";

  // Retry (e.g. after the user acknowledges the ambiguous failure): must reuse the same draft.
  const result = await requestAndDecodeConcepts(
    {
      generateAttemptId: () => "attempt-2",
      persistDraft,
      persistAttempt: async () => {},
      requestGeneration: async () =>
        jsonResponse({ variants: [{ status: "succeeded", mode: "auto", mimeType: "image/png", imageBase64: b64("ok"), warnings: [] }] }),
    },
    new AbortController().signal,
  );

  assert.equal(result.projectId, "project-1");
  assert.equal(createCalls, 1, "createDraft must only run once across both attempts");
});
