import { test } from "node:test";
import assert from "node:assert/strict";
import { applyConceptReviewToProject, ProjectSyncError, syncLocalProject, type ProjectSyncDependencies } from "./project-sync";
import type { Project } from "./types";

const project = { id: "local-one" } as Project;

function dependencies(overrides: Partial<ProjectSyncDependencies> = {}) {
  const records: unknown[] = [];
  let imports = 0;
  const deps: ProjectSyncDependencies = {
    loadLocalProject: async () => project,
    saveSyncRecord: async (record) => { records.push(record); },
    importProject: async () => { imports += 1; return { serverProjectId: "server-one", importedAt: "done" }; },
    now: () => "now",
    ...overrides,
  };
  return { deps, records, get imports() { return imports; } };
}

test("successful sync records progress and server mapping without deleting the local project", async () => {
  let loads = 0;
  const harness = dependencies({ loadLocalProject: async () => { loads += 1; return project; } });
  const result = await syncLocalProject("local-one", harness.deps);
  assert.equal(result.serverProjectId, "server-one");
  assert.equal(loads, 1);
  assert.equal(harness.imports, 1);
  assert.deepEqual(harness.records, [
    { localProjectId: "local-one", status: "syncing", updatedAt: "now" },
    { localProjectId: "local-one", status: "synced", serverProjectId: "server-one", updatedAt: "now" },
  ]);
});

test("failed sync keeps a recoverable failed record and a safe message", async () => {
  const harness = dependencies({ importProject: async () => { throw new ProjectSyncError("backend-not-ready", "Backend не готов."); } });
  await assert.rejects(syncLocalProject("local-one", harness.deps), /Backend не готов/);
  assert.deepEqual(harness.records.at(-1), {
    localProjectId: "local-one",
    status: "failed",
    errorCode: "backend-not-ready",
    updatedAt: "now",
  });
});

test("retry uses the same local project id as the server idempotency key", async () => {
  const importedIds: string[] = [];
  const harness = dependencies({
    importProject: async (value) => {
      importedIds.push(value.id);
      if (importedIds.length === 1) throw new ProjectSyncError("temporary", "Повторите позже.");
      return { serverProjectId: "server-one", importedAt: "done" };
    },
  });
  await assert.rejects(syncLocalProject("local-one", harness.deps));
  await syncLocalProject("local-one", harness.deps);
  assert.deepEqual(importedIds, ["local-one", "local-one"]);
});

test("cloud snapshot includes the separately persisted concept selection and feedback", () => {
  const local = { ...project, selectedConceptId: null, feedback: [] };
  const merged = applyConceptReviewToProject(local, {
    selectedConceptId: "concept-one",
    feedback: [{ id: "feedback-one", conceptId: "concept-one", author: "Роман", createdAt: "now", comment: "Сохранить" }],
  });
  assert.equal(merged.selectedConceptId, "concept-one");
  assert.equal(merged.feedback.length, 1);
  assert.equal(local.selectedConceptId, null);
});
