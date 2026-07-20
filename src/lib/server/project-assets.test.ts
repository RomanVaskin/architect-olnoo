import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signPath, signPaths } from "./project-assets";

function fakeSupabase(createSignedUrl: (path: string) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>) {
  return {
    storage: {
      from: (bucket: string) => {
        assert.equal(bucket, "project-assets");
        return { createSignedUrl };
      },
    },
  } as unknown as SupabaseClient;
}

test("signPath returns null (never throws) for a null/undefined storage path", async () => {
  const supabase = fakeSupabase(async () => ({ data: null, error: null }));
  assert.equal(await signPath(supabase, null), null);
  assert.equal(await signPath(supabase, undefined), null);
});

test("signPath returns the signed url on success", async () => {
  const supabase = fakeSupabase(async (path) => ({ data: { signedUrl: `https://signed.example/${path}` }, error: null }));
  assert.equal(await signPath(supabase, "ws/proj/file.jpg"), "https://signed.example/ws/proj/file.jpg");
});

test("signPath swallows a Storage error and returns null instead of throwing", async () => {
  const supabase = fakeSupabase(async () => ({ data: null, error: { message: "object not found" } }));
  assert.equal(await signPath(supabase, "ws/proj/missing.jpg"), null);
});

test("signPath swallows a thrown exception and returns null", async () => {
  const supabase = {
    storage: { from: () => ({ createSignedUrl: async () => { throw new Error("network down"); } }) },
  } as unknown as SupabaseClient;
  assert.equal(await signPath(supabase, "ws/proj/file.jpg"), null);
});

test("signPaths preserves order and signs each path independently, nulls included", async () => {
  const supabase = fakeSupabase(async (path) => (path === "bad" ? { data: null, error: { message: "nope" } } : { data: { signedUrl: `signed:${path}` }, error: null }));
  const result = await signPaths(supabase, ["a", "bad", "b", null]);
  assert.deepEqual(result, ["signed:a", null, "signed:b", null]);
});
