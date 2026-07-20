import { test } from "node:test";
import assert from "node:assert/strict";
import { GEOMETRY_REVIEW_ADVISORY, notRunGeometryReport, parseGeometryReview, reviewGeometrySafely } from "./geometry-reviewer";

function payload(overrides: Record<string, Partial<{ status: string; confidence: number; explanation: string }>> = {}) {
  return JSON.stringify({
    summary: "Сравнение завершено",
    checks: ["camera", "volumes", "roof", "openings", "proportions"].map((key) => ({
      key,
      status: "consistent",
      confidence: 0.9,
      explanation: `${key}: явных расхождений не видно`,
      ...overrides[key],
    })),
  });
}

test("reports no obvious deviations only when every required check is consistently high-confidence", () => {
  const report = parseGeometryReview(payload());
  assert.equal(report.status, "no-obvious-deviations");
  assert.equal(report.confidence, 0.9);
  assert.equal(report.checks.length, 5);
  assert.equal(report.advisory, GEOMETRY_REVIEW_ADVISORY);
});

test("a high-confidence possible deviation takes precedence over otherwise consistent checks", () => {
  const report = parseGeometryReview(payload({ roof: { status: "possible-deviation", confidence: 0.82 } }));
  assert.equal(report.status, "possible-deviations");
});

test("uncertain or low-confidence results remain inconclusive instead of being presented as verified", () => {
  const uncertain = parseGeometryReview(payload({ openings: { status: "uncertain", confidence: 0.45 } }));
  assert.equal(uncertain.status, "inconclusive");

  const lowConfidence = parseGeometryReview(payload({ camera: { confidence: 0.55 } }));
  assert.equal(lowConfidence.status, "inconclusive");
});

test("rejects malformed, incomplete and duplicate structured responses", () => {
  assert.throws(() => parseGeometryReview("not-json"), /invalid-review-json/);
  assert.throws(() => parseGeometryReview(JSON.stringify({ checks: [] })), /incomplete-review-checks/);
  const duplicate = JSON.parse(payload()) as { checks: Array<{ key: string }> };
  duplicate.checks[4].key = "roof";
  assert.throws(() => parseGeometryReview(JSON.stringify(duplicate)), /incomplete-review-checks/);
});

test("not-run report is explicit and retains the specialist-review advisory", () => {
  const report = notRunGeometryReport("Проверка отключена.");
  assert.equal(report.status, "not-run");
  assert.equal(report.summary, "Проверка отключена.");
  assert.equal(report.checks.length, 0);
  assert.match(report.advisory, /не заменяет проверку/);
});

test("a reviewer failure becomes a non-fatal not-run report", async () => {
  const errors: unknown[] = [];
  const report = await reviewGeometrySafely(
    { review: async () => { throw new Error("provider unavailable"); } },
    {
      primaryImage: { data: Buffer.from("source"), mimeType: "image/png", role: "front", purpose: "primary" },
      generatedImage: { data: Buffer.from("result"), mimeType: "image/png" },
      constraints: { goal: "Редизайн", explicitChanges: "Материал", mustKeep: ["Крыша"], mayChange: ["Цвет"] },
    },
    new AbortController().signal,
    (error) => errors.push(error),
  );
  assert.equal(report.status, "not-run");
  assert.equal(errors.length, 1);
});
