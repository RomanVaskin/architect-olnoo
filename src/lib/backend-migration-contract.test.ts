import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202607200001_backend_foundation.sql", "utf8");

test("backend migration enables RLS on every public application table", () => {
  for (const table of [
    "workspaces",
    "workspace_members",
    "projects",
    "project_files",
    "source_views",
    "concepts",
    "concept_versions",
    "generation_attempts",
    "activity_events",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  }
});

test("project assets are private and policies require authenticated project access", () => {
  assert.match(migration, /'project-assets',[\s\S]*?false,/);
  assert.match(migration, /project_assets_select[\s\S]*?to authenticated/);
  assert.match(migration, /private\.can_access_project_path\(name, false\)/);
  assert.match(migration, /private\.can_access_project_path\(name, true\)/);
});

test("migration never grants anon access or embeds a service-role credential", () => {
  assert.doesNotMatch(migration, /to anon/i);
  assert.doesNotMatch(migration, /service[_-]?role/i);
  assert.match(migration, /revoke all on table[\s\S]*?from anon/);
  assert.match(migration, /grant select, insert, update, delete on table[\s\S]*?to authenticated/);
});

test("only workspace owners may manage membership roles", () => {
  assert.match(migration, /create trigger workspaces_add_owner_membership[\s\S]*?private\.add_workspace_owner_membership\(\)/);
  assert.match(migration, /workspace_members_insert[\s\S]*?private\.is_workspace_owner\(workspace_id\)/);
  assert.match(migration, /workspace_members_update[\s\S]*?private\.is_workspace_owner\(workspace_id\)/);
  assert.match(migration, /workspace_members_delete[\s\S]*?private\.is_workspace_owner\(workspace_id\)/);
  assert.match(migration, /workspace_members_update[\s\S]*?not private\.is_canonical_workspace_owner\(workspace_id, user_id\)/);
  assert.match(migration, /workspace_members_delete[\s\S]*?not private\.is_canonical_workspace_owner\(workspace_id, user_id\)/);
});

test("project-scoped references cannot point to records from another project", () => {
  assert.match(migration, /foreign key \(project_id, source_file_id\)[\s\S]*?references public\.project_files\(project_id, id\)/);
  assert.match(migration, /foreign key \(project_id, image_file_id\)[\s\S]*?references public\.project_files\(project_id, id\)/);
  assert.match(migration, /foreign key \(project_id, parent_concept_id\)[\s\S]*?references public\.concepts\(project_id, id\)/);
  assert.match(migration, /foreign key \(id, selected_concept_id\)[\s\S]*?references public\.concepts\(project_id, id\)/);
  assert.match(migration, /foreign key \(project_id, concept_id\)[\s\S]*?references public\.concepts\(project_id, id\)/);
  assert.match(migration, /foreign key \(project_id, source_concept_id\)[\s\S]*?references public\.concepts\(project_id, id\)/);
});
