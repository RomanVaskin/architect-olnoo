import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapActivityEventRow,
  mapConceptRow,
  mapConceptVersionRow,
  mapFeedbackRow,
  mapProjectRow,
  mapSourceFileRow,
  mapSourceViewRow,
} from "./project-row-mapping";

test("mapProjectRow maps snake_case DB columns to the app model", () => {
  const project = mapProjectRow({
    id: "p-1",
    name: "Дом на Валдае",
    building_type: "Частный дом",
    lifecycle_stage: "concept",
    state: "awaiting-review",
    site: { address: "Валдай", climateZone: "Умеренный", areaSqm: 1200 },
    brief: { goal: "Обновить фасад", mustKeep: ["Геометрия"], mayChange: [], wantsChanged: [] },
    selected_concept_id: "c-1",
    updated_at: "2026-07-20T00:00:00Z",
  });
  assert.equal(project.id, "p-1");
  assert.equal(project.buildingType, "Частный дом");
  assert.equal(project.lifecycleStage, "concept");
  assert.equal(project.selectedConceptId, "c-1");
  assert.deepEqual(project.site, { address: "Валдай", climateZone: "Умеренный", areaSqm: 1200 });
  assert.deepEqual(project.brief.mustKeep, ["Геометрия"]);
});

test("mapProjectRow tolerates malformed jsonb site/brief instead of throwing", () => {
  const project = mapProjectRow({
    id: "p-1",
    name: "X",
    building_type: "Y",
    lifecycle_stage: "intake",
    state: "draft",
    site: null,
    brief: null,
    selected_concept_id: null,
    updated_at: "2026-07-20T00:00:00Z",
  });
  assert.deepEqual(project.site, { address: "", climateZone: "", areaSqm: 0 });
  assert.deepEqual(project.brief, { goal: "", mustKeep: [], mayChange: [], wantsChanged: [] });
  assert.equal(project.selectedConceptId, null);
});

test("mapSourceFileRow prefers metadata.uploadedAt and attaches the signed url when given", () => {
  const withUrl = mapSourceFileRow(
    { id: "f-1", kind: "photo", name: "a.jpg", mime_type: "image/jpeg", metadata: { uploadedAt: "2026-01-01T00:00:00Z", dimensions: { width: 10, height: 20 } }, created_at: "2026-07-20T00:00:00Z" },
    "https://signed.example/a.jpg",
  );
  assert.equal(withUrl.uploadedAt, "2026-01-01T00:00:00Z");
  assert.deepEqual(withUrl.dimensions, { width: 10, height: 20 });
  assert.equal(withUrl.imageUrl, "https://signed.example/a.jpg");

  const withoutUrl = mapSourceFileRow(
    { id: "f-2", kind: "drawing", name: "b.pdf", mime_type: null, metadata: {}, created_at: "2026-07-20T00:00:00Z" },
    null,
  );
  assert.equal(withoutUrl.uploadedAt, "2026-07-20T00:00:00Z");
  assert.equal("imageUrl" in withoutUrl, false);
});

test("mapSourceFileRow falls back to 'document' for an unrecognized kind rather than crashing", () => {
  const file = mapSourceFileRow({ id: "f-3", kind: "export", name: "c.pdf", mime_type: null, metadata: {}, created_at: "now" }, null);
  assert.equal(file.kind, "document");
});

test("mapSourceViewRow maps crop/order/role/primary and never leaves imageKey empty", () => {
  const view = mapSourceViewRow({
    id: "v-1",
    source_file_id: "f-1",
    role: "front",
    crop: { x: 1, y: 2, width: 3, height: 4 },
    sort_order: 0,
    is_primary: true,
  });
  assert.equal(view.sourceImageId, "f-1");
  assert.equal(view.isPrimary, true);
  assert.deepEqual(view.crop, { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(view.imageKey.length > 0, true);
});

test("mapConceptRow only attaches generatedImage when there is a mode or an image url", () => {
  const withImage = mapConceptRow(
    {
      id: "c-1",
      parent_concept_id: null,
      image_file_id: "f-1",
      label: "A",
      state: "awaiting-review",
      summary: "s",
      change_explanation: "e",
      generation_mode: "balanced",
      warnings: ["w1", 2, "w2"],
      source_provenance: null,
      geometry_verification: null,
      created_at: "now",
    },
    "https://signed.example/c1.jpg",
  );
  assert.equal(withImage.generatedImage?.url, "https://signed.example/c1.jpg");
  assert.equal(withImage.generatedImage?.fileId, "f-1");
  assert.deepEqual(withImage.generatedImage?.warnings, ["w1", "w2"]);

  const withoutImage = mapConceptRow(
    {
      id: "c-2",
      parent_concept_id: null,
      image_file_id: null,
      label: "B",
      state: "draft",
      summary: "s",
      change_explanation: "e",
      generation_mode: null,
      warnings: [],
      source_provenance: null,
      geometry_verification: null,
      created_at: "now",
    },
    null,
  );
  assert.equal(withoutImage.generatedImage, undefined);
});

test("mapConceptRow only keeps source/geometry provenance shaped like the real thing", () => {
  const concept = mapConceptRow(
    {
      id: "c-1",
      parent_concept_id: "c-0",
      image_file_id: null,
      label: "A",
      state: "draft",
      summary: "s",
      change_explanation: "e",
      generation_mode: null,
      warnings: [],
      source_provenance: { sourceFileId: "sf-1" },
      geometry_verification: { status: "inconclusive" },
      created_at: "now",
    },
    null,
  );
  assert.equal(concept.parentConceptId, "c-0");
  assert.ok(concept.sourceProvenance);
  assert.ok(concept.geometryVerification);

  const malformed = mapConceptRow(
    {
      id: "c-2",
      parent_concept_id: null,
      image_file_id: null,
      label: "A",
      state: "draft",
      summary: "s",
      change_explanation: "e",
      generation_mode: null,
      warnings: [],
      source_provenance: { notTheRightShape: true },
      geometry_verification: "not-an-object",
      created_at: "now",
    },
    null,
  );
  assert.equal(malformed.sourceProvenance, undefined);
  assert.equal(malformed.geometryVerification, undefined);
});

test("mapConceptVersionRow and mapFeedbackRow map ids and text through", () => {
  assert.deepEqual(mapConceptVersionRow({ id: "v-1", concept_id: "c-1", label: "L", change_summary: "S", created_at: "now" }), {
    id: "v-1",
    conceptId: "c-1",
    label: "L",
    createdAt: "now",
    changeSummary: "S",
  });
  assert.deepEqual(mapFeedbackRow({ id: "fb-1", concept_id: "c-1", author_name: "Роман", comment: "Отлично", created_at: "now" }), {
    id: "fb-1",
    conceptId: "c-1",
    author: "Роман",
    createdAt: "now",
    comment: "Отлично",
  });
});

test("mapFeedbackRow falls back to a generic author label for an empty name", () => {
  const feedback = mapFeedbackRow({ id: "fb-1", concept_id: "c-1", author_name: "", comment: "x", created_at: "now" });
  assert.equal(feedback.author, "Пользователь");
});

test("mapActivityEventRow prefers metadata.actorName, else a label derived from actor_type", () => {
  const named = mapActivityEventRow({ id: "a-1", actor_type: "user", action: "Создан проект", metadata: { actorName: "Роман" }, created_at: "now" });
  assert.equal(named.actor, "Роман");
  assert.equal(named.actorType, "user");

  const agent = mapActivityEventRow({ id: "a-2", actor_type: "agent", action: "Сгенерирована концепция", metadata: {}, created_at: "now" });
  assert.equal(agent.actor, "AI Architect");

  const system = mapActivityEventRow({ id: "a-3", actor_type: "system", action: "x", metadata: {}, created_at: "now" });
  assert.equal(system.actorType, "user");
});
