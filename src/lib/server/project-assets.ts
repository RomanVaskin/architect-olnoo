import type { SupabaseClient } from "@supabase/supabase-js";

const PROJECT_ASSETS_BUCKET = "project-assets";

/** Signed URLs are short-lived on purpose (see specs/server-project-repository.md) — long enough for one workspace visit, short enough to bound exposure if a URL leaks. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Signs one private Storage path under the caller's own RLS session (the
 * `project_assets_select` policy in supabase/migrations/202607200001_backend_foundation.sql
 * still applies to signing, not just downloading, so this can never be used
 * to mint a URL for another project's asset). Returns null — never throws —
 * on any failure so a missing/unavailable image degrades to the existing
 * placeholder UI instead of breaking the page.
 */
export async function signPath(
  supabase: SupabaseClient,
  storagePath: string | null | undefined,
  expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!storagePath) return null;
  try {
    const result = await supabase.storage.from(PROJECT_ASSETS_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
    if (result.error || !result.data?.signedUrl) return null;
    return result.data.signedUrl;
  } catch {
    return null;
  }
}

/** Batched variant for a project detail response, preserving input order and never throwing per-item. */
export async function signPaths(
  supabase: SupabaseClient,
  storagePaths: Array<string | null | undefined>,
  expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<Array<string | null>> {
  return Promise.all(storagePaths.map((path) => signPath(supabase, path, expiresInSeconds)));
}
