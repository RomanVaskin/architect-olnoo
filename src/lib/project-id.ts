import { DEMO_PROJECT_IDS } from "./mock-data";

/**
 * Project ids come from three disjoint sources (see docs/06-BACKEND.md —
 * Project Resolution): a Postgres `uuid` primary key for Supabase-backed
 * projects, a `local-<uuid>` id minted by createDraftProject
 * (mvp-local-project-store.ts) for IndexedDB-only projects, and a small,
 * explicit set of demo ids (mock-data.ts). Every resolver/UI decision about
 * where a project's data lives goes through these three checks so the order
 * is defined in exactly one place.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDemoProjectId(id: string): boolean {
  return DEMO_PROJECT_IDS.has(id);
}

export function isLocalProjectId(id: string): boolean {
  return id.startsWith("local-");
}

export function isServerProjectId(id: string): boolean {
  return UUID_PATTERN.test(id);
}
