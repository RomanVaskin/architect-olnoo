import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPreDispatchAttempt,
  findGenerationAttempt,
  findPersistedConceptByAttempt,
  GenerationAttemptRepositoryError,
  persistGeneratedConcept,
  type PersistGeneratedConceptInput,
} from "./generation-attempt-repository";

type Result = { data: unknown; error: { message: string; code?: string } | null };

interface FakeOptions {
  results?: Record<string, Result>;
  uploadError?: { message: string } | null;
  signedUrl?: string | null;
  updateCalls?: Array<{ table: string; value: Record<string, unknown> }>;
  insertCalls?: Array<{ table: string; value: Record<string, unknown> }>;
  upsertCalls?: Array<{ table: string; value: Record<string, unknown> }>;
}

function fakeSupabase(options: FakeOptions = {}) {
  const results = options.results ?? {};

  function builder(table: string): PromiseLike<Result> & Record<string, unknown> {
    const result = results[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      insert: (value: Record<string, unknown>) => {
        options.insertCalls?.push({ table, value });
        return chain;
      },
      upsert: (value: Record<string, unknown>) => {
        options.upsertCalls?.push({ table, value });
        return chain;
      },
      update: (value: Record<string, unknown>) => {
        options.updateCalls?.push({ table, value });
        return chain;
      },
      maybeSingle: () => Promise.resolve(result),
      single: () => Promise.resolve(result),
      then: (onFulfilled: (value: Result) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };
    return chain as PromiseLike<Result> & Record<string, unknown>;
  }

  return {
    from: builder,
    storage: {
      from: () => ({
        upload: async () => (options.uploadError ? { data: null, error: options.uploadError } : { data: { path: "x" }, error: null }),
        createSignedUrl: async () =>
          options.signedUrl === undefined || options.signedUrl
            ? { data: { signedUrl: options.signedUrl ?? "https://signed.example/x.jpg" }, error: null }
            : { data: null, error: { message: "not found" } },
      }),
    },
  } as unknown as SupabaseClient;
}

function baseInput(overrides: Partial<PersistGeneratedConceptInput> = {}): PersistGeneratedConceptInput {
  return {
    attemptKey: "attempt-1",
    workspaceId: "w-1",
    projectId: "p-1",
    userId: "u-1",
    imageBytes: Buffer.from("fake-image-bytes"),
    mimeType: "image/png",
    label: "Концепция A",
    summary: "summary",
    changeExplanation: "explanation",
    mode: "balanced",
    warnings: [],
    sourceProvenance: {
      sourceFileId: "sf-1",
      sourceViewId: "sv-1",
      sourceFileName: "front.jpg",
      role: "front",
      crop: { x: 0, y: 0, width: 10, height: 10 },
      payload: { mimeType: "image/jpeg", width: 10, height: 10, sizeBytes: 100 },
    },
    ...overrides,
  };
}

test("findGenerationAttempt returns null when no row exists", async () => {
  const supabase = fakeSupabase({ results: { generation_attempts: { data: null, error: null } } });
  const attempt = await findGenerationAttempt(supabase, "attempt-1");
  assert.equal(attempt, null);
});

test("findGenerationAttempt maps an existing row", async () => {
  const supabase = fakeSupabase({
    results: {
      generation_attempts: {
        data: { id: "a-1", attempt_key: "attempt-1", project_id: "p-1", status: "dispatched", error_code: null, source_provenance: null },
        error: null,
      },
    },
  });
  const attempt = await findGenerationAttempt(supabase, "attempt-1");
  assert.deepEqual(attempt, { id: "a-1", attemptKey: "attempt-1", projectId: "p-1", status: "dispatched", errorCode: null, sourceProvenance: null });
});

test("createPreDispatchAttempt treats a unique-violation (23505) as success, not an error — a concurrent retry with the same key must not throw", async () => {
  const supabase = fakeSupabase({ results: { generation_attempts: { data: null, error: { message: "duplicate key", code: "23505" } } } });
  await createPreDispatchAttempt(supabase, { attemptKey: "attempt-1", projectId: "p-1", userId: "u-1", kind: "initial" });
});

test("createPreDispatchAttempt surfaces any other database error", async () => {
  const supabase = fakeSupabase({ results: { generation_attempts: { data: null, error: { message: "connection reset" } } } });
  await assert.rejects(createPreDispatchAttempt(supabase, { attemptKey: "attempt-1", projectId: "p-1", userId: "u-1", kind: "initial" }));
});

test("persistGeneratedConcept succeeds end to end: uploads once, upserts project_files/concepts/activity, marks the attempt completed", async () => {
  const updateCalls: Array<{ table: string; value: Record<string, unknown> }> = [];
  const supabase = fakeSupabase({
    results: {
      project_files: { data: { id: "file-1" }, error: null },
      concepts: { data: { id: "concept-1" }, error: null },
      activity_events: { data: null, error: null },
      projects: { data: null, error: null },
      generation_attempts: { data: null, error: null },
    },
    updateCalls,
  });

  const result = await persistGeneratedConcept(supabase, baseInput());
  assert.equal(result.conceptId, "concept-1");
  assert.equal(result.imageUrl, "https://signed.example/x.jpg");

  const attemptUpdate = updateCalls.find((call) => call.table === "generation_attempts");
  assert.equal(attemptUpdate?.value.status, "completed");
  const projectUpdate = updateCalls.find((call) => call.table === "projects");
  assert.equal(projectUpdate?.value.lifecycle_stage, "concept");
});

test("persistGeneratedConcept marks the attempt persistence-partial (not failed) when the Storage upload itself fails, and never touches concepts", async () => {
  const updateCalls: Array<{ table: string; value: Record<string, unknown> }> = [];
  const supabase = fakeSupabase({ uploadError: { message: "storage down" }, updateCalls });

  await assert.rejects(persistGeneratedConcept(supabase, baseInput()), (error: unknown) => {
    assert.ok(error instanceof GenerationAttemptRepositoryError);
    assert.equal(error.code, "storage-failed");
    return true;
  });

  const attemptUpdate = updateCalls.find((call) => call.table === "generation_attempts");
  assert.equal(attemptUpdate?.value.status, "persistence-partial");
  assert.equal(attemptUpdate?.value.error_code, "storage-upload-failed");
});

test("persistGeneratedConcept marks the attempt persistence-partial when a database write fails after a successful upload", async () => {
  const updateCalls: Array<{ table: string; value: Record<string, unknown> }> = [];
  const supabase = fakeSupabase({
    results: {
      project_files: { data: { id: "file-1" }, error: null },
      concepts: { data: null, error: { message: "constraint violation" } },
      generation_attempts: { data: null, error: null },
    },
    updateCalls,
  });

  await assert.rejects(persistGeneratedConcept(supabase, baseInput()), (error: unknown) => {
    assert.ok(error instanceof GenerationAttemptRepositoryError);
    assert.equal(error.code, "database-failed");
    return true;
  });

  const attemptUpdate = updateCalls.find((call) => call.table === "generation_attempts");
  assert.equal(attemptUpdate?.value.status, "persistence-partial");
});

test("persistGeneratedConcept writes a concept_versions row and a parent_concept_id only for a correction (parentConceptId set)", async () => {
  const upsertCalls: Array<{ table: string; value: Record<string, unknown> }> = [];
  const supabase = fakeSupabase({
    results: {
      project_files: { data: { id: "file-1" }, error: null },
      concepts: { data: { id: "concept-2" }, error: null },
      concept_versions: { data: null, error: null },
      activity_events: { data: null, error: null },
      projects: { data: null, error: null },
      generation_attempts: { data: null, error: null },
    },
    upsertCalls,
  });

  const result = await persistGeneratedConcept(supabase, baseInput({ parentConceptId: "concept-1", attemptKey: "attempt-2" }));
  assert.equal(result.conceptId, "concept-2");

  const conceptUpsert = upsertCalls.find((call) => call.table === "concepts");
  assert.equal(conceptUpsert?.value.parent_concept_id, "concept-1");
  const versionUpsert = upsertCalls.find((call) => call.table === "concept_versions");
  assert.equal(versionUpsert?.value.concept_id, "concept-2");
  assert.equal(versionUpsert?.value.client_import_key, "attempt-2-version");
});

test("findPersistedConceptByAttempt resolves an already-persisted concept back without any write — the idempotent-retry read path", async () => {
  const supabase = fakeSupabase({
    results: {
      concepts: { data: { id: "concept-1", image_file_id: "file-1" }, error: null },
      project_files: { data: { storage_path: "w-1/p-1/generation-attempts/attempt-1.png" }, error: null },
    },
  });
  const persisted = await findPersistedConceptByAttempt(supabase, "p-1", "attempt-1");
  assert.deepEqual(persisted, { conceptId: "concept-1", imageUrl: "https://signed.example/x.jpg" });
});

test("findPersistedConceptByAttempt returns null when no concept has been persisted for this attempt yet", async () => {
  const supabase = fakeSupabase({ results: { concepts: { data: null, error: null } } });
  const persisted = await findPersistedConceptByAttempt(supabase, "p-1", "attempt-1");
  assert.equal(persisted, null);
});
