import type { GeometryVerificationReport, ProjectState } from "./types";

/** Converts an advisory Reviewer result into an honest workflow state. */
export function conceptStateFromGeometryReview(report?: GeometryVerificationReport): ProjectState {
  if (!report) return "awaiting-review";
  return report.status === "no-obvious-deviations" ? "awaiting-review" : "needs-specialist-review";
}

export function geometryReviewNeedsAttention(report?: GeometryVerificationReport): boolean {
  return Boolean(report && report.status !== "no-obvious-deviations");
}
