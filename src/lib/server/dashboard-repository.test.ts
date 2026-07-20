import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DashboardRepositoryError, getDashboardSummary } from "./dashboard-repository";

type Result = { data: unknown; error: { message: string } | null; count?: number | null };

/** Minimal fake mirroring the one in project-repository.test.ts — keyed by table name, one shape per test scenario. */
function fakeSupabase(resultsByTable: Record<string, Result>) {
  function builder(table: string): PromiseLike<Result> & Record<string, unknown> {
    const result = resultsByTable[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      then: (onFulfilled: (value: Result) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    };
    return chain as PromiseLike<Result> & Record<string, unknown>;
  }
  return { from: builder } as unknown as SupabaseClient;
}

test("getDashboardSummary returns zeroed counts and empty lists for a brand-new account", async () => {
  const supabase = fakeSupabase({
    projects: { data: null, error: null, count: 0 },
    concepts: { data: [], error: null, count: 0 },
    activity_events: { data: [], error: null },
  });
  const summary = await getDashboardSummary(supabase);
  assert.equal(summary.projectsNeedingSpecialistReview, 0);
  assert.equal(summary.conceptsAwaitingReview, 0);
  assert.deepEqual(summary.pendingDecisions, []);
  assert.deepEqual(summary.recentActivity, []);
});

test("getDashboardSummary maps pending concepts joined with their project name", async () => {
  const supabase = fakeSupabase({
    projects: { data: null, error: null, count: 1 },
    concepts: {
      data: [
        { id: "c-1", label: "Концепция A", state: "awaiting-review", created_at: "2026-07-01T00:00:00Z", project_id: "p-1", projects: { name: "Дом" } },
      ],
      error: null,
      count: 2,
    },
    activity_events: { data: [], error: null },
  });
  const summary = await getDashboardSummary(supabase);
  assert.equal(summary.projectsNeedingSpecialistReview, 1);
  assert.equal(summary.conceptsAwaitingReview, 2);
  assert.deepEqual(summary.pendingDecisions, [
    { conceptId: "c-1", conceptLabel: "Концепция A", conceptState: "awaiting-review", conceptCreatedAt: "2026-07-01T00:00:00Z", projectId: "p-1", projectName: "Дом" },
  ]);
});

test("getDashboardSummary drops a pending concept row whose project join is missing (RLS edge case) instead of throwing", async () => {
  const supabase = fakeSupabase({
    projects: { data: null, error: null, count: 0 },
    concepts: {
      data: [{ id: "c-1", label: "X", state: "awaiting-review", created_at: "now", project_id: "p-1", projects: null }],
      error: null,
      count: 0,
    },
    activity_events: { data: [], error: null },
  });
  const summary = await getDashboardSummary(supabase);
  assert.deepEqual(summary.pendingDecisions, []);
});

test("getDashboardSummary maps recent activity, defaulting agent actor name when metadata has none", async () => {
  const supabase = fakeSupabase({
    projects: { data: null, error: null, count: 0 },
    concepts: { data: [], error: null, count: 0 },
    activity_events: {
      data: [{ id: "a-1", actor_type: "agent", action: "Сгенерирована концепция", metadata: {}, created_at: "2026-07-01T00:00:00Z", project_id: "p-1", projects: { name: "Дом" } }],
      error: null,
    },
  });
  const summary = await getDashboardSummary(supabase);
  assert.deepEqual(summary.recentActivity, [
    { id: "a-1", actor: "AI Architect", actorType: "agent", action: "Сгенерирована концепция", createdAt: "2026-07-01T00:00:00Z", projectId: "p-1", projectName: "Дом" },
  ]);
});

test("getDashboardSummary wraps a raw Postgres error without leaking its message", async () => {
  const supabase = fakeSupabase({
    projects: { data: null, error: { message: 'relation "public.projects" does not exist' }, count: null },
  });
  await assert.rejects(getDashboardSummary(supabase), (error: unknown) => {
    assert.ok(error instanceof DashboardRepositoryError);
    assert.equal(error.message.includes("relation"), false);
    return true;
  });
});
