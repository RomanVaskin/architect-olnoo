import { test } from "node:test";
import assert from "node:assert/strict";
import { createWizardDraftSaver } from "./wizard-draft-save";
import { buildProjectImportPackage } from "./project-import-contract";
import { syncLocalProject, type ProjectSyncDependencies } from "./project-sync";
import type { DraftProjectInput } from "./mvp-local-project-store";
import type { Project } from "./types";

const input = { name: "Черновик без генерации" } as DraftProjectInput;

test("saving a draft calls only the local draft writer and performs zero network requests", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("draft saving must never reach the network");
  }) as typeof fetch;
  try {
    let created = 0;
    const saver = createWizardDraftSaver(async () => {
      created += 1;
      return "local-draft-1";
    });
    assert.equal(await saver.save(null, input), "local-draft-1");
    assert.equal(created, 1);
    assert.equal(fetchCalls, 0, "no fetch may happen while saving a draft");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rapid repeated clicks join one in-flight save and create exactly one draft", async () => {
  let created = 0;
  let release: (id: string) => void = () => {};
  const gate = new Promise<string>((resolve) => {
    release = resolve;
  });
  const saver = createWizardDraftSaver(() => {
    created += 1;
    return gate;
  });

  const clicks = [saver.save(null, input), saver.save(null, input), saver.save(null, input)];
  release("local-draft-2");
  assert.deepEqual(await Promise.all(clicks), ["local-draft-2", "local-draft-2", "local-draft-2"]);
  assert.equal(created, 1);
});

test("an already saved draft id is reused without writing a second draft", async () => {
  let created = 0;
  const saver = createWizardDraftSaver(async () => {
    created += 1;
    return "local-draft-3";
  });
  assert.equal(await saver.save(null, input), "local-draft-3");
  assert.equal(await saver.save("local-draft-3", input), "local-draft-3");
  // Even before the caller's state has propagated the id back, the resolved
  // in-flight promise keeps answering with the same draft.
  assert.equal(await saver.save(null, input), "local-draft-3");
  assert.equal(created, 1);
});

test("a failed save clears the in-flight slot so the user can retry", async () => {
  let attempts = 0;
  const saver = createWizardDraftSaver(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("storage-quota");
    return "local-draft-4";
  });
  await assert.rejects(saver.save(null, input), /storage-quota/);
  assert.equal(await saver.save(null, input), "local-draft-4");
  assert.equal(attempts, 2);
});

function savedDraftProject(): Project {
  const id = "local-draft-sync";
  return {
    id,
    name: "Черновик для синхронизации",
    buildingType: "Частный дом",
    coverImage: id,
    lifecycleStage: "intake",
    state: "draft",
    updatedAt: "2026-07-21T00:00:00.000Z",
    site: { address: "Не указано", climateZone: "Не указано", areaSqm: 0 },
    brief: { goal: "Обновить фасад дома, сохранив геометрию", mustKeep: ["Геометрия"], mayChange: ["Цвет"], wantsChanged: ["Покрасить фасад"] },
    sourceFiles: [
      {
        id: `${id}-src-0`,
        name: "facade.jpg",
        kind: "photo",
        uploadedAt: "2026-07-21T00:00:00.000Z",
        imageKey: `${id}-src-0:image`,
        mimeType: "image/jpeg",
        dimensions: { width: 40, height: 30 },
        imageBlob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/jpeg" }),
      },
    ],
    sourceViews: [
      {
        id: `${id}-view-0`,
        sourceImageId: `${id}-src-0`,
        crop: { x: 0, y: 0, width: 40, height: 30 },
        order: 0,
        role: "front",
        isPrimary: true,
        imageKey: `${id}-src-0:image`,
      },
    ],
    concepts: [],
    selectedConceptId: null,
    versions: [],
    feedback: [],
    activity: [],
  };
}

test("a zero-concept draft builds a valid, deterministic import package (no concept assets)", () => {
  const draft = savedDraftProject();
  const first = buildProjectImportPackage(draft);
  const second = buildProjectImportPackage(draft);

  assert.equal(first.manifest.localProjectId, draft.id);
  assert.deepEqual(first.manifest.project.concepts, []);
  assert.equal(first.assets.length, 1, "only the source photo is uploaded for a draft");
  assert.equal(first.assets[0].descriptor.ownerType, "source-file");
  assert.deepEqual(first.manifest.assets, second.manifest.assets, "repeated builds stay identical for idempotent retries");
  assert.equal(second.manifest.localProjectId, draft.id);
});

test("syncing a saved draft twice sends the same local id both times and never deletes the local copy", async () => {
  const draft = savedDraftProject();
  const importedIds: string[] = [];
  let loads = 0;
  const deps: ProjectSyncDependencies = {
    loadLocalProject: async () => {
      loads += 1;
      return draft;
    },
    saveSyncRecord: async () => {},
    importProject: async (project) => {
      importedIds.push(project.id);
      return { serverProjectId: "server-draft", importedAt: "t" };
    },
    now: () => "t",
  };

  await syncLocalProject(draft.id, deps);
  await syncLocalProject(draft.id, deps);

  assert.deepEqual(importedIds, [draft.id, draft.id], "the local id stays the server idempotency key across repeats");
  assert.equal(loads, 2, "sync only ever reads the local project — there is no delete dependency at all");
});
