import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeProjectSources } from "./project-list-merge";
import type { LocalProjectSyncRecord } from "./mvp-local-project-store";
import type { Project } from "./types";
import type { ServerProjectSummary } from "./server/project-repository";

function localProject(id: string): Project {
  return {
    id,
    name: id,
    buildingType: "Частный дом",
    coverImage: "",
    lifecycleStage: "intake",
    state: "draft",
    updatedAt: "now",
    site: { address: "", climateZone: "", areaSqm: 0 },
    brief: { goal: "", mustKeep: [], mayChange: [], wantsChanged: [] },
    sourceFiles: [],
    concepts: [],
    selectedConceptId: null,
    versions: [],
    feedback: [],
    activity: [],
  };
}

function serverSummary(id: string): ServerProjectSummary {
  return {
    id,
    name: id,
    buildingType: "Частный дом",
    coverImage: "",
    lifecycleStage: "intake",
    state: "draft",
    updatedAt: "now",
    site: { address: "", climateZone: "", areaSqm: 0 },
  };
}

test("a synced local project is dropped from the local list — no duplicate card", () => {
  const synced: LocalProjectSyncRecord = { localProjectId: "local-1", status: "synced", serverProjectId: "server-1", updatedAt: "now" };
  const merged = mergeProjectSources(
    [serverSummary("server-1")],
    [localProject("local-1"), localProject("local-2")],
    new Map([["local-1", synced]]),
    [],
  );
  assert.deepEqual(merged.local.map((p) => p.id), ["local-2"]);
  assert.deepEqual(merged.cloud.map((p) => p.id), ["server-1"]);
});

test("a local project with no sync record, or a failed/syncing one, stays in the local list", () => {
  const failed: LocalProjectSyncRecord = { localProjectId: "local-2", status: "failed", updatedAt: "now" };
  const merged = mergeProjectSources(
    [],
    [localProject("local-1"), localProject("local-2")],
    new Map([["local-2", failed]]),
    [],
  );
  assert.deepEqual(merged.local.map((p) => p.id).sort(), ["local-1", "local-2"]);
});

test("demo projects pass through untouched and separately from cloud/local", () => {
  const merged = mergeProjectSources([serverSummary("s-1")], [localProject("local-1")], new Map(), [localProject("demo-1")]);
  assert.equal(merged.demo.length, 1);
  assert.equal(merged.demo[0].id, "demo-1");
  assert.equal(merged.cloud.length, 1);
  assert.equal(merged.local.length, 1);
});

test("everything empty produces an honestly empty merge, not a fallback to demo", () => {
  const merged = mergeProjectSources([], [], new Map(), []);
  assert.deepEqual(merged, { cloud: [], local: [], demo: [] });
});
