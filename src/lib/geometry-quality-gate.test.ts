import { test } from "node:test";
import assert from "node:assert/strict";
import { conceptStateFromGeometryReview, geometryReviewNeedsAttention } from "./geometry-quality-gate";
import type { GeometryVerificationReport } from "./types";

function report(status: GeometryVerificationReport["status"]): GeometryVerificationReport {
  return { status, confidence: 0.8, summary: status, checks: [], advisory: "Нужен специалист" };
}

test("only a no-obvious-deviations result clears the automatic quality gate", () => {
  assert.equal(conceptStateFromGeometryReview(report("no-obvious-deviations")), "awaiting-review");
  assert.equal(geometryReviewNeedsAttention(report("no-obvious-deviations")), false);

  for (const status of ["possible-deviations", "inconclusive", "not-run"] as const) {
    assert.equal(conceptStateFromGeometryReview(report(status)), "needs-specialist-review");
    assert.equal(geometryReviewNeedsAttention(report(status)), true);
  }
});

test("legacy concepts without a report keep their previous awaiting-review behavior", () => {
  assert.equal(conceptStateFromGeometryReview(undefined), "awaiting-review");
  assert.equal(geometryReviewNeedsAttention(undefined), false);
});
