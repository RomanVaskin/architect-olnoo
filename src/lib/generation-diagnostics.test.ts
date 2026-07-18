import { test } from "node:test";
import assert from "node:assert/strict";
import { logGenerationDiagnostic, safeErrorCode } from "./generation-diagnostics";

const SECRET = "sk-live-topsecretprovidertoken-should-never-be-logged";

test("safeErrorCode classifies a plain Error by name, never by message", () => {
  const error = new Error(SECRET);
  assert.equal(safeErrorCode(error), "Error");
});

test("safeErrorCode classifies a subclassed Error (e.g. TypeError) by its name", () => {
  const error = new TypeError(SECRET);
  assert.equal(safeErrorCode(error), "TypeError");
});

test("safeErrorCode classifies a DOMException by its name", () => {
  const error = new DOMException(SECRET, "QuotaExceededError");
  assert.equal(safeErrorCode(error), "QuotaExceededError");
});

test("safeErrorCode never echoes non-Error values back verbatim", () => {
  assert.equal(safeErrorCode(SECRET), "Unknown:string");
  assert.equal(safeErrorCode(undefined), "UnknownError");
  assert.equal(safeErrorCode(null), "UnknownError");
});

test("logGenerationDiagnostic logs only attemptId, stage, and a safe code — never the raw error", () => {
  const originalConsoleError = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    const error = new Error(SECRET);
    // "request" is not a persistence stage, so this is the console.error path.
    const diagnostic = logGenerationDiagnostic("attempt-123", "request", error);

    assert.deepEqual(diagnostic, { attemptId: "attempt-123", stage: "request", code: "Error" });
    assert.equal(calls.length, 1);

    const serializedCall = JSON.stringify(calls[0]);
    assert.equal(serializedCall.includes(SECRET), false, "logged output must never contain the raw error message");
    assert.equal(calls[0].some((arg) => arg instanceof Error), false, "logged output must never contain the raw Error object");
  } finally {
    console.error = originalConsoleError;
  }
});

test("logGenerationDiagnostic uses console.warn (not console.error) for persistence stages, so Next.js's dev error overlay does not fire on a handled save failure", () => {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const errorCalls: unknown[][] = [];
  const warnCalls: unknown[][] = [];
  console.error = (...args: unknown[]) => errorCalls.push(args);
  console.warn = (...args: unknown[]) => warnCalls.push(args);

  try {
    const error = new Error(SECRET);
    for (const stage of ["persist-draft", "persist-attempt", "persist-concept", "persist-concept-image", "persist-concept-metadata"] as const) {
      logGenerationDiagnostic("attempt-123", stage, error);
    }

    assert.equal(errorCalls.length, 0, "persistence stages must never use console.error");
    assert.equal(warnCalls.length, 5);
    assert.equal(JSON.stringify(warnCalls).includes(SECRET), false);
  } finally {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
});
