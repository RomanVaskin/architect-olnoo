import { test } from "node:test";
import assert from "node:assert/strict";
import { findLatestGeneratedConcept, findPrimarySourceFile, resolveProjectCover } from "./project-cover";
import type { Concept, SourceFile, SourceView } from "./types";

function concept(id: string, createdAt: string, generatedImage?: Concept["generatedImage"]): Concept {
  return { id, label: id, createdAt, state: "draft", summary: "", changeExplanation: "", generatedImage };
}

function sourceFile(id: string, extra: Partial<SourceFile> = {}): SourceFile {
  return { id, name: id, kind: "photo", uploadedAt: "now", ...extra };
}

function sourceView(sourceImageId: string, isPrimary: boolean): SourceView {
  return { id: `view-${sourceImageId}`, sourceImageId, crop: { x: 0, y: 0, width: 1, height: 1 }, order: 0, role: "front", isPrimary, imageKey: sourceImageId };
}

test("findLatestGeneratedConcept picks the most recently created concept that has a generated image", () => {
  const concepts = [
    concept("c-1", "2026-01-01", { mimeType: "image/png", mode: "auto", warnings: [], url: "old.jpg" }),
    concept("c-2", "2026-01-02"),
    concept("c-3", "2026-01-03", { mimeType: "image/png", mode: "auto", warnings: [], url: "new.jpg" }),
  ];
  assert.equal(findLatestGeneratedConcept(concepts)?.id, "c-3");
});

test("findLatestGeneratedConcept skips concepts without a generated image even if newer", () => {
  const concepts = [concept("c-1", "2026-01-01", { mimeType: "image/png", mode: "auto", warnings: [], url: "old.jpg" }), concept("c-2", "2026-01-02")];
  assert.equal(findLatestGeneratedConcept(concepts)?.id, "c-1");
});

test("findPrimarySourceFile matches the Primary Source View regardless of the file's kind", () => {
  const sourceFiles = [sourceFile("f-1", { kind: "drawing" }), sourceFile("f-2", { kind: "photo" })];
  const sourceViews = [sourceView("f-2", false), sourceView("f-1", true)];
  assert.equal(findPrimarySourceFile(sourceViews, sourceFiles)?.id, "f-1");
});

test("findPrimarySourceFile returns undefined when no view is marked primary or sourceViews is undefined", () => {
  const sourceFiles = [sourceFile("f-1")];
  assert.equal(findPrimarySourceFile([sourceView("f-1", false)], sourceFiles), undefined);
  assert.equal(findPrimarySourceFile(undefined, sourceFiles), undefined);
});

test("resolveProjectCover prefers the latest generated concept image over the primary source photo", () => {
  const concepts = [concept("c-1", "2026-01-01", { mimeType: "image/png", mode: "auto", warnings: [], url: "concept.jpg" })];
  const sourceFiles = [sourceFile("f-1", { imageUrl: "photo.jpg" })];
  const cover = resolveProjectCover(concepts, [sourceView("f-1", true)], sourceFiles);
  assert.equal(cover.url, "concept.jpg");
});

test("resolveProjectCover falls back to the primary source photo when no concept has a generated image yet", () => {
  const sourceFiles = [sourceFile("f-1", { imageUrl: "photo.jpg" })];
  const cover = resolveProjectCover([concept("c-1", "2026-01-01")], [sourceView("f-1", true)], sourceFiles);
  assert.equal(cover.url, "photo.jpg");
});

test("resolveProjectCover returns an empty source when nothing is available", () => {
  const cover = resolveProjectCover([], undefined, []);
  assert.deepEqual(cover, {});
});

test("resolveProjectCover carries the Blob through for local (IndexedDB) projects, alongside any URL", () => {
  const blob = new Blob(["x"]);
  const sourceFiles = [sourceFile("f-1", { imageBlob: blob })];
  const cover = resolveProjectCover([], [sourceView("f-1", true)], sourceFiles);
  assert.equal(cover.blob, blob);
});
