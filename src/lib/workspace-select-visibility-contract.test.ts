import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202607200002_fix_workspace_select_visibility.sql", "utf8");

test("workspace owners can see their own workspace immediately after creating it", () => {
  assert.match(migration, /drop policy workspaces_select on public\.workspaces;/);
  assert.match(migration, /create policy workspaces_select on public\.workspaces for select to authenticated/);
  assert.match(migration, /owner_user_id = \(select auth\.uid\(\)\) or private\.is_workspace_member\(id\)/);
});
