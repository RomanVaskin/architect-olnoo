-- Fixes a bug found while verifying 202607200001 end-to-end: PostgreSQL
-- requires a row inserted with RETURNING to also satisfy the table's SELECT
-- policy. workspaces_select depended only on private.is_workspace_member(id),
-- which reads workspace_members -- populated by the workspaces_add_owner_
-- membership AFTER INSERT trigger. That trigger's effect is not guaranteed
-- visible to the RETURNING clause's implicit SELECT-policy check within the
-- same statement, so every new user's first `insert(...).select()` on
-- workspaces (exactly what ensureWorkspace() in
-- src/lib/server/project-import-repository.ts does) failed with
-- "new row violates row-level security policy for table workspaces".
--
-- Fix: let the owner see their own workspace row directly via owner_user_id,
-- independent of the trigger-created membership row's visibility timing.
-- Functionally this changes nothing for steady-state access (the owner is
-- always also a workspace_members row), it only removes the same-statement
-- race for the very first insert.

drop policy workspaces_select on public.workspaces;

create policy workspaces_select on public.workspaces for select to authenticated
using (
  (select auth.uid()) is not null
  and (owner_user_id = (select auth.uid()) or private.is_workspace_member(id))
);
