import { test } from "node:test";
import assert from "node:assert/strict";
import { GenerationError } from "./errors";

test("userMessage returns the specific detail when one was given", () => {
  const error = new GenerationError("unsupported-file", "Файл «a.pdf» — PDF пока не поддерживается моделью.");
  assert.equal(error.userMessage, "Файл «a.pdf» — PDF пока не поддерживается моделью.");
});

test("userMessage falls back to the generic message for the code when no detail was given", () => {
  const error = new GenerationError("rate-limit");
  assert.match(error.userMessage, /Превышен лимит запросов/);
});

test("every error code has a non-empty generic message", () => {
  const codes = [
    "missing-api-key",
    "unsupported-file",
    "provider-timeout",
    "safety-rejection",
    "rate-limit",
    "quota-exhausted",
    "malformed-response",
    "provider-failure",
    "validation",
  ] as const;
  for (const code of codes) {
    const error = new GenerationError(code);
    assert.ok(error.userMessage.length > 0, `expected a message for code ${code}`);
  }
});
