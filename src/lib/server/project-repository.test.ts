import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addConceptFeedback, getServerProjectDetail, ProjectRepositoryError, setSelectedConcept } from "./project-repository";

type Result = { data: unknown; error: { message: string } | null };

/**
 * Minimal fake of the subset of the Supabase query-builder chain the
 * repository actually calls (select/eq/in/not/order/insert/update, then
 * either a terminal .maybeSingle()/.single() or awaiting the builder
 * directly — supabase-js query builders are themselves thenable). Keyed by
 * table name only; each test configures exactly the tables its scenario
 * touches, since one function call only ever needs one shape per table.
 */
function fakeSupabase(resultsByTable: Record<string, Result>, signedUrl: string | null = "https://signed.example/x.jpg") {
  function builder(table: string): PromiseLike<Result> & Record<string, unknown> {
    const result = resultsByTable[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      not: () => chain,
      order: () => chain,
      insert: () => chain,
      update: () => chain,
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
      from: () => ({ createSignedUrl: async () => (signedUrl ? { data: { signedUrl }, error: null } : { data: null, error: { message: "not found" } }) }),
    },
  } as unknown as SupabaseClient;
}

test("getServerProjectDetail throws a safe not-found error when the project row is absent (RLS-hidden or nonexistent, indistinguishable by design)", async () => {
  const supabase = fakeSupabase({ projects: { data: null, error: null } });
  await assert.rejects(getServerProjectDetail(supabase, "p-1"), (error: unknown) => {
    assert.ok(error instanceof ProjectRepositoryError);
    assert.equal(error.code, "not-found");
    return true;
  });
});

test("getServerProjectDetail wraps a raw Postgres error as a generic database-failed code, never leaking the message", async () => {
  const supabase = fakeSupabase({ projects: { data: null, error: { message: "relation \"public.projects\" does not exist" } } });
  await assert.rejects(getServerProjectDetail(supabase, "p-1"), (error: unknown) => {
    assert.ok(error instanceof ProjectRepositoryError);
    assert.equal(error.code, "database-failed");
    assert.equal(error.message.includes("relation"), false);
    return true;
  });
});

test("getServerProjectDetail maps a minimal project with no files/concepts to an empty-but-well-formed Project", async () => {
  const supabase = fakeSupabase({
    projects: {
      data: {
        id: "p-1",
        name: "Дом",
        building_type: "Частный дом",
        lifecycle_stage: "intake",
        state: "draft",
        site: {},
        brief: {},
        selected_concept_id: null,
        updated_at: "now",
      },
      error: null,
    },
    project_files: { data: [], error: null },
    source_views: { data: [], error: null },
    concepts: { data: [], error: null },
    concept_versions: { data: [], error: null },
    concept_feedback: { data: [], error: null },
    activity_events: { data: [], error: null },
  });
  const project = await getServerProjectDetail(supabase, "p-1");
  assert.equal(project.id, "p-1");
  assert.deepEqual(project.sourceFiles, []);
  assert.deepEqual(project.concepts, []);
  assert.equal(project.coverImage, "");
});

test("setSelectedConcept rejects a concept id that does not belong to the project as invalid-request", async () => {
  const supabase = fakeSupabase({ concepts: { data: null, error: null } });
  await assert.rejects(setSelectedConcept(supabase, "p-1", "c-not-in-project"), (error: unknown) => {
    assert.ok(error instanceof ProjectRepositoryError);
    assert.equal(error.code, "invalid-request");
    return true;
  });
});

test("setSelectedConcept succeeds when the concept belongs to the project and the project row is updated", async () => {
  const supabase = fakeSupabase({
    concepts: { data: { id: "c-1" }, error: null },
    projects: { data: { id: "p-1" }, error: null },
  });
  await setSelectedConcept(supabase, "p-1", "c-1");
});

test("setSelectedConcept allows clearing the selection (null) without a concept-ownership check", async () => {
  const supabase = fakeSupabase({ projects: { data: { id: "p-1" }, error: null } });
  await setSelectedConcept(supabase, "p-1", null);
});

test("setSelectedConcept surfaces not-found when the project row itself disappears mid-request", async () => {
  const supabase = fakeSupabase({ projects: { data: null, error: null } });
  await assert.rejects(setSelectedConcept(supabase, "p-1", null), (error: unknown) => {
    assert.ok(error instanceof ProjectRepositoryError);
    assert.equal(error.code, "not-found");
    return true;
  });
});

test("addConceptFeedback rejects a concept id that does not belong to the project", async () => {
  const supabase = fakeSupabase({ concepts: { data: null, error: null } });
  await assert.rejects(addConceptFeedback(supabase, "p-1", "c-x", "Отлично", "user-1", "Роман"), (error: unknown) => {
    assert.ok(error instanceof ProjectRepositoryError);
    assert.equal(error.code, "invalid-request");
    return true;
  });
});

test("addConceptFeedback inserts and returns the mapped Feedback row", async () => {
  const supabase = fakeSupabase({
    concepts: { data: { id: "c-1" }, error: null },
    concept_feedback: { data: { id: "fb-1", concept_id: "c-1", author_name: "Роман", comment: "Отлично", created_at: "now" }, error: null },
  });
  const feedback = await addConceptFeedback(supabase, "p-1", "c-1", "Отлично", "user-1", "Роман");
  assert.deepEqual(feedback, { id: "fb-1", conceptId: "c-1", author: "Роман", createdAt: "now", comment: "Отлично" });
});
