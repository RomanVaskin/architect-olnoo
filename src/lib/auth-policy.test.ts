import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAuthRuntimePolicy } from "./auth-policy";

test("configured Supabase always requires a verified session", () => {
  assert.equal(resolveAuthRuntimePolicy(true, "development", "localhost"), "required");
  assert.equal(resolveAuthRuntimePolicy(true, "production", "example.com"), "required");
});

test("only loopback local development may run without Supabase while it is being connected", () => {
  assert.equal(resolveAuthRuntimePolicy(false, "development", "localhost"), "local-development-bypass");
  assert.equal(resolveAuthRuntimePolicy(false, "development", "127.0.0.1"), "local-development-bypass");
  assert.equal(resolveAuthRuntimePolicy(false, "development", "192.168.2.1"), "configuration-required");
  assert.equal(resolveAuthRuntimePolicy(false, "production", "localhost"), "configuration-required");
  assert.equal(resolveAuthRuntimePolicy(false, "test", "localhost"), "configuration-required");
});
