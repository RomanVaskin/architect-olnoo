import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDashboardView } from "./dashboard-merge";
import type { Concept, Project } from "./types";
import type { ServerProjectSummary } from "./server/project-repository";
import type { DashboardSummary } from "./server/dashboard-repository";

function concept(id: string, state: Concept["state"], createdAt: string): Concept {
  return { id, label: id, createdAt, state, summary: "", changeExplanation: "" };
}

function localProject(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: id,
    buildingType: "Частный дом",
    coverImage: "",
    lifecycleStage: "intake",
    state: "draft",
    updatedAt: "2026-07-01T00:00:00Z",
    site: { address: "", climateZone: "", areaSqm: 0 },
    brief: { goal: "", mustKeep: [], mayChange: [], wantsChanged: [] },
    sourceFiles: [],
    concepts: [],
    selectedConceptId: null,
    versions: [],
    feedback: [],
    activity: [],
    ...overrides,
  };
}

function serverSummary(id: string, updatedAt = "2026-07-02T00:00:00Z"): ServerProjectSummary {
  return {
    id,
    name: id,
    buildingType: "Частный дом",
    coverImage: "",
    lifecycleStage: "intake",
    state: "draft",
    updatedAt,
    site: { address: "", climateZone: "", areaSqm: 0 },
  };
}

test("an empty account (no cloud, no local) produces an honestly empty view, not a fallback to demo counts", () => {
  const view = buildDashboardView(null, [], []);
  assert.equal(view.cloudProjectCount, 0);
  assert.equal(view.localUnsyncedCount, 0);
  assert.equal(view.conceptsAwaitingReview, 0);
  assert.equal(view.projectsNeedingSpecialistReview, 0);
  assert.equal(view.hasAnyRealProject, false);
  assert.deepEqual(view.recentProjects, []);
  assert.deepEqual(view.pendingDecisions, []);
  assert.deepEqual(view.recentActivity, []);
});

test("a cloud fetch failure (summary null) never renders as empty when local data exists", () => {
  const local = localProject("local-1", { concepts: [concept("c-1", "awaiting-review", "2026-07-01T00:00:00Z")] });
  const view = buildDashboardView(null, [], [local]);
  assert.equal(view.hasAnyRealProject, true);
  assert.equal(view.localUnsyncedCount, 1);
  assert.equal(view.conceptsAwaitingReview, 1);
});

test("concepts-awaiting-review and specialist-review counts combine cloud and local sources", () => {
  const summary: DashboardSummary = {
    projectsNeedingSpecialistReview: 2,
    conceptsAwaitingReview: 3,
    pendingDecisions: [],
    recentActivity: [],
  };
  const local = localProject("local-1", {
    state: "needs-specialist-review",
    concepts: [concept("c-1", "awaiting-review", "2026-07-01T00:00:00Z")],
  });
  const view = buildDashboardView(summary, [serverSummary("s-1")], [local]);
  assert.equal(view.conceptsAwaitingReview, 4);
  assert.equal(view.projectsNeedingSpecialistReview, 3);
  assert.equal(view.cloudProjectCount, 1);
});

test("recent projects merge cloud and local, sorted by updatedAt descending, and tag their origin", () => {
  const local = localProject("local-1", { updatedAt: "2026-07-03T00:00:00Z" });
  const view = buildDashboardView(null, [serverSummary("s-1", "2026-07-01T00:00:00Z")], [local]);
  assert.deepEqual(view.recentProjects.map((p) => p.id), ["local-1", "s-1"]);
  assert.equal(view.recentProjects[0].origin, "local");
  assert.equal(view.recentProjects[1].origin, "cloud");
});

test("pending decisions from local projects only include awaiting-review and needs-specialist-review concepts", () => {
  const local = localProject("local-1", {
    concepts: [
      concept("c-1", "awaiting-review", "2026-07-01T00:00:00Z"),
      concept("c-2", "approved", "2026-07-02T00:00:00Z"),
      concept("c-3", "needs-specialist-review", "2026-07-03T00:00:00Z"),
    ],
  });
  const view = buildDashboardView(null, [], [local]);
  assert.deepEqual(
    view.pendingDecisions.map((item) => item.conceptId),
    ["c-3", "c-1"],
  );
});
