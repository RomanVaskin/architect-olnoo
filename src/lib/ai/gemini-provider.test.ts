import { test } from "node:test";
import assert from "node:assert/strict";
import { GenerationError } from "./errors";
import { isQuotaExhaustedMessage, mapProviderError } from "./gemini-provider";

// A trimmed but real example of the body Gemini returns when a project's
// free-tier quota for an image model is zero (captured from a live 429).
const QUOTA_EXHAUSTED_BODY = JSON.stringify({
  error: {
    code: 429,
    message:
      "You exceeded your current quota... \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image\nPlease retry in 7.29s.",
    status: "RESOURCE_EXHAUSTED",
  },
});

// A transient burst-limit body: same shape, but the metric has a positive limit.
const TRANSIENT_RATE_LIMIT_BODY = JSON.stringify({
  error: {
    code: 429,
    message:
      "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_requests_per_minute, limit: 15, model: gemini-3.1-flash-image\nPlease retry in 3s.",
    status: "RESOURCE_EXHAUSTED",
  },
});

function apiErrorLike(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

test("isQuotaExhaustedMessage detects a zero-limit quota body", () => {
  assert.equal(isQuotaExhaustedMessage(QUOTA_EXHAUSTED_BODY), true);
});

test("isQuotaExhaustedMessage does not flag a positive-limit rate body", () => {
  assert.equal(isQuotaExhaustedMessage(TRANSIENT_RATE_LIMIT_BODY), false);
});

test("isQuotaExhaustedMessage falls back to scanning raw text when not JSON", () => {
  assert.equal(isQuotaExhaustedMessage("random text, limit: 0, more text"), true);
  assert.equal(isQuotaExhaustedMessage("random text with no limit info"), false);
});

test("mapProviderError classifies a zero-quota 429 as quota-exhausted, not rate-limit", () => {
  const error = mapProviderError(apiErrorLike(429, QUOTA_EXHAUSTED_BODY));
  assert.ok(error instanceof GenerationError);
  assert.equal(error.code, "quota-exhausted");
  assert.match(error.userMessage, /биллинг/i);
  assert.doesNotMatch(error.userMessage, /RESOURCE_EXHAUSTED/);
  assert.doesNotMatch(error.userMessage, /generativelanguage\.googleapis\.com/);
});

test("mapProviderError classifies a transient 429 as rate-limit", () => {
  const error = mapProviderError(apiErrorLike(429, TRANSIENT_RATE_LIMIT_BODY));
  assert.ok(error instanceof GenerationError);
  assert.equal(error.code, "rate-limit");
  assert.match(error.userMessage, /Подождите/);
});

test("mapProviderError maps abort/timeout statuses without leaking provider details", () => {
  const abortError = Object.assign(new Error("The user aborted a request."), { name: "AbortError" });
  assert.equal(mapProviderError(abortError).code, "provider-timeout");
  assert.equal(mapProviderError(apiErrorLike(504, "gateway timeout")).code, "provider-timeout");
  assert.equal(mapProviderError(apiErrorLike(500, "internal error, secret=abc123")).code, "provider-failure");
});

test("mapProviderError passes through an existing GenerationError unchanged", () => {
  const original = new GenerationError("safety-rejection");
  assert.equal(mapProviderError(original), original);
});
