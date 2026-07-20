import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRepositoryError, ProjectRepositoryError } from "./project-repository";

/**
 * Exercises the pure error->response mapping used by every /api/projects/*
 * route (see repositoryErrorResponse in project-route-helpers.ts). The
 * NextResponse-wrapping layer itself isn't unit tested here — importing
 * next/server fails under this repo's plain `node --test` runner, matching
 * every other Route Handler in the codebase (none are unit tested directly);
 * this covers the actual status/code/no-leak logic instead.
 */

test("classifyRepositoryError maps not-found to 404 with a generic message", () => {
  const classified = classifyRepositoryError(new ProjectRepositoryError("not-found", "project-detail"));
  assert.equal(classified.status, 404);
  assert.equal(classified.code, "not-found");
});

test("classifyRepositoryError maps invalid-request to 400", () => {
  const classified = classifyRepositoryError(new ProjectRepositoryError("invalid-request", "feedback"));
  assert.equal(classified.status, 400);
  assert.equal(classified.code, "invalid-request");
});

test("classifyRepositoryError maps database-failed to 503 and never forwards the raw Postgres message", () => {
  const raw = new ProjectRepositoryError("database-failed", "select");
  raw.message = 'relation "public.projects" does not exist';
  const classified = classifyRepositoryError(raw);
  assert.equal(classified.status, 503);
  assert.equal(classified.message.includes("relation"), false);
  assert.equal(classified.message.includes("does not exist"), false);
});

test("classifyRepositoryError treats an unrecognized/unknown error the same as a temporary failure, never echoing it", () => {
  const classified = classifyRepositoryError(new Error("some internal detail with a stack trace"));
  assert.equal(classified.status, 503);
  assert.equal(classified.message.includes("internal detail"), false);
});
