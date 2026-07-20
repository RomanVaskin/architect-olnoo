-- Backend Foundation 2: multi-tenant project data and private project assets.
-- Applied to architect-olnoo (ref iaomlfkcbjeqpgnbpwxs) on 2026-07-20 after
-- review; see 202607200002_fix_workspace_select_visibility.sql for a
-- follow-up fix found during verification.

-- ============================================================================
-- LEGACY SCHEMA CLEANUP
--
-- The target project (architect-olnoo, ref iaomlfkcbjeqpgnbpwxs) already
-- contained an unrelated, empty schema from prior unrelated scaffolding
-- (organizations/profiles/tasks/project_comments/project_objects/etc.),
-- including a `public.projects` and `public.project_files` that collide by
-- name with the tables this migration creates below. Verified immediately
-- before this migration was authored:
--   - all 11 legacy tables: 0 rows
--   - auth.users: 0 rows (no user has ever signed up on this project)
--   - storage bucket 'project-files': 0 objects
--   - no views depend on any of these tables
-- Full schema-only backup (columns, constraints, indexes, policies,
-- functions) captured at supabase/backups/pre-cleanup-architect-olnoo-20260720.sql
-- before this migration was written.
--
-- Drop order below is chosen so every statement succeeds without CASCADE:
-- each table is dropped only after every legacy table that references it
-- (via foreign key) has already been dropped. A table's own indexes,
-- triggers, and RLS policies are removed automatically as part of DROP
-- TABLE (they belong to the table); that is intrinsic Postgres behavior,
-- not the CASCADE keyword, and every policy so removed is enumerated here
-- for transparency:
--   design_briefs:        design_briefs_select/insert/update/delete
--   project_comments:     project_comments_select/insert/update/delete
--   project_files:        project_files_select/insert/update/delete
--   project_members:      project_members_select/insert/update/delete
--   tasks:                tasks_select/insert/update/delete
--   project_versions:     project_versions_select/insert/update/delete
--   project_objects:      project_objects_select/insert/update/delete
--   projects:              projects_select/insert/update/delete
--   organization_members: organization_members_select/insert/update/delete
--   organizations:        organizations_select/insert/update/delete
--   profiles:              profiles_select/update
-- and each table's own `<table>_updated_at` trigger (all backed by the
-- public.set_updated_at() function dropped near the end).
--
-- Two dependencies are NOT owned by any of the 11 tables above and must be
-- dropped explicitly, in this exact order, before the tables/functions they
-- reference:
--   1. `on_auth_user_created` lives on auth.users (not being dropped) and
--      calls public.handle_new_user(), which inserts into public.profiles.
--      Left in place, it would silently break every future signup (test
--      accounts included) the moment profiles is gone. Dropped first, then
--      its function.
--   2. Four RLS policies on storage.objects (project_storage_select/
--      insert/update/delete) reference can_manage_project(), is_project_
--      member(), and try_uuid() and are scoped to `bucket_id =
--      'project-files'` only (verified via pg_policies; they cannot match
--      any other bucket, including the new 'project-assets' bucket this
--      migration creates). Dropped explicitly before those functions.
--
-- The empty 'project-files' storage bucket itself is deliberately NOT
-- dropped here: Supabase enforces storage.protect_delete() on
-- storage.buckets, which raises on any plain SQL DELETE and requires the
-- Storage API instead, which in turn requires an elevated administrative
-- key this project's own security policy says never to use. Bucket
-- removal is intentionally left as a separate, manual, non-transactional
-- step for the project owner (Supabase Dashboard -> Storage -> delete
-- 'project-files'), decoupled from this migration. It does not conflict
-- with anything created below.
--
-- Recovery if this transaction fails partway: it cannot leave partial
-- state. The whole file below (cleanup + creation) is sent to Postgres as
-- one multi-statement query, which Postgres treats as a single implicit
-- transaction (no BEGIN/COMMIT is used, and nothing here requires running
-- outside a transaction, e.g. no CONCURRENTLY). Any failure at any
-- statement rolls back every statement before it, leaving the database
-- exactly as it was pre-migration; simply fix the cause and re-run
-- `supabase db push --linked`.

drop trigger on_auth_user_created on auth.users;
drop function public.handle_new_user();

drop policy project_storage_select on storage.objects;
drop policy project_storage_insert on storage.objects;
drop policy project_storage_update on storage.objects;
drop policy project_storage_delete on storage.objects;

drop table public.design_briefs;
drop table public.project_comments;
drop table public.project_files;
drop table public.project_members;
drop table public.tasks;
drop table public.project_versions;
drop table public.project_objects;
drop table public.projects;
drop table public.organization_members;
drop table public.organizations;
drop table public.profiles;

drop function public.handle_new_organization();
drop function public.can_create_project(uuid);
drop function public.can_manage_org(uuid);
drop function public.can_manage_project(uuid);
drop function public.is_org_member(uuid);
drop function public.is_project_member(uuid);
drop function public.set_updated_at();
drop function public.shares_org(uuid);
drop function public.try_uuid(text);

-- ============================================================================
-- ARCHITECT OLNOO SCHEMA

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.workspace_role as enum ('owner', 'editor', 'viewer');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_import_key text not null default gen_random_uuid()::text,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 200),
  building_type text not null default 'Частный дом',
  lifecycle_stage text not null default 'intake' check (lifecycle_stage in ('intake', 'concept', 'design-development', 'professional-documentation', 'construction-documentation', 'construction-support', 'operation-modernization')),
  state text not null default 'draft' check (state in ('draft', 'in-progress', 'awaiting-review', 'needs-specialist-review', 'approved', 'blocked', 'archived')),
  site jsonb not null default '{}'::jsonb,
  brief jsonb not null default '{}'::jsonb,
  selected_concept_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, client_import_key)
);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_import_key text not null default gen_random_uuid()::text,
  created_by uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('photo', 'drawing', 'document', 'concept', 'export')),
  name text not null check (char_length(name) between 1 and 300),
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  storage_path text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, client_import_key)
);

create table public.source_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_import_key text not null default gen_random_uuid()::text,
  source_file_id uuid not null,
  role text not null check (role in ('front', 'side', 'rear', 'detail', 'other')),
  crop jsonb not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, client_import_key),
  foreign key (project_id, source_file_id)
    references public.project_files(project_id, id) on delete cascade
);

create unique index source_views_one_primary_per_project
  on public.source_views(project_id)
  where is_primary;

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_import_key text not null default gen_random_uuid()::text,
  parent_concept_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  image_file_id uuid,
  label text not null check (char_length(label) between 1 and 240),
  state text not null default 'awaiting-review' check (state in ('draft', 'in-progress', 'awaiting-review', 'needs-specialist-review', 'approved', 'blocked', 'archived')),
  summary text not null default '',
  change_explanation text not null default '',
  generation_mode text,
  warnings jsonb not null default '[]'::jsonb,
  source_provenance jsonb,
  geometry_verification jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, id),
  unique (project_id, client_import_key),
  foreign key (project_id, image_file_id)
    references public.project_files(project_id, id)
    deferrable initially deferred,
  foreign key (project_id, parent_concept_id)
    references public.concepts(project_id, id)
    deferrable initially deferred
);

alter table public.projects
  add constraint projects_selected_concept_fk
  foreign key (id, selected_concept_id)
  references public.concepts(project_id, id)
  deferrable initially deferred;

create table public.concept_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_import_key text not null default gen_random_uuid()::text,
  concept_id uuid not null,
  label text not null,
  change_summary text not null default '',
  created_at timestamptz not null default now(),
  unique (project_id, client_import_key),
  foreign key (project_id, concept_id)
    references public.concepts(project_id, id) on delete cascade
);

create table public.generation_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_key text not null unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('initial', 'correction', 'review')),
  source_concept_id uuid,
  status text not null default 'created',
  source_provenance jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (project_id, source_concept_id)
    references public.concepts(project_id, id)
    deferrable initially deferred
);

create table public.concept_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_import_key text not null default gen_random_uuid()::text,
  concept_id uuid not null,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name text not null default '',
  comment text not null check (char_length(comment) between 1 and 5000),
  created_at timestamptz not null default now(),
  unique (project_id, client_import_key),
  foreign key (project_id, concept_id)
    references public.concepts(project_id, id) on delete cascade
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_import_key text not null default gen_random_uuid()::text,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'agent', 'system')),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, client_import_key)
);

create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index projects_workspace_id_idx on public.projects(workspace_id);
create index project_files_project_id_idx on public.project_files(project_id);
create index source_views_project_id_idx on public.source_views(project_id);
create index concepts_project_id_created_at_idx on public.concepts(project_id, created_at desc);
create index concept_versions_project_id_created_at_idx on public.concept_versions(project_id, created_at desc);
create index generation_attempts_project_id_created_at_idx on public.generation_attempts(project_id, created_at desc);
create index concept_feedback_project_id_created_at_idx on public.concept_feedback(project_id, created_at desc);
create index activity_events_project_id_created_at_idx on public.activity_events(project_id, created_at desc);

create function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

create function private.can_edit_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'editor')
  );
$$;

create function private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role = 'owner'
  );
$$;

create function private.is_canonical_workspace_owner(target_workspace_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = target_workspace_id
      and w.owner_user_id = target_user_id
  );
$$;

create function private.add_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner'::public.workspace_role);
  return new;
end;
$$;

create trigger workspaces_add_owner_membership
after insert on public.workspaces
for each row execute function private.add_workspace_owner_membership();

create function private.project_workspace(target_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.workspace_id from public.projects p where p.id = target_project_id;
$$;

create function private.can_view_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_workspace_member(private.project_workspace(target_project_id));
$$;

create function private.can_edit_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_edit_workspace(private.project_workspace(target_project_id));
$$;

create function private.can_access_project_path(object_name text, require_edit boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  path_parts text[];
  target_workspace_id uuid;
  target_project_id uuid;
begin
  path_parts := storage.foldername(object_name);
  if array_length(path_parts, 1) < 2 then return false; end if;
  target_workspace_id := path_parts[1]::uuid;
  target_project_id := path_parts[2]::uuid;
  if private.project_workspace(target_project_id) is distinct from target_workspace_id then return false; end if;
  if require_edit then return private.can_edit_project(target_project_id); end if;
  return private.can_view_project(target_project_id);
exception when others then
  return false;
end;
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon;
grant execute on function private.set_updated_at() to authenticated;

create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function private.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
for each row execute function private.set_updated_at();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_files enable row level security;
alter table public.source_views enable row level security;
alter table public.concepts enable row level security;
alter table public.concept_versions enable row level security;
alter table public.generation_attempts enable row level security;
alter table public.concept_feedback enable row level security;
alter table public.activity_events enable row level security;

revoke all on table
  public.workspaces,
  public.workspace_members,
  public.projects,
  public.project_files,
  public.source_views,
  public.concepts,
  public.concept_versions,
  public.generation_attempts,
  public.concept_feedback,
  public.activity_events
from anon;

grant select, insert, update, delete on table
  public.workspaces,
  public.workspace_members,
  public.projects,
  public.project_files,
  public.source_views,
  public.concepts,
  public.concept_versions,
  public.generation_attempts,
  public.concept_feedback,
  public.activity_events
to authenticated;
grant usage on type public.workspace_role to authenticated;

create policy workspaces_select on public.workspaces for select to authenticated
using ((select auth.uid()) is not null and private.is_workspace_member(id));
create policy workspaces_insert on public.workspaces for insert to authenticated
with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
create policy workspaces_update on public.workspaces for update to authenticated
using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy workspaces_delete on public.workspaces for delete to authenticated
using (owner_user_id = (select auth.uid()));

create policy workspace_members_select on public.workspace_members for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy workspace_members_insert on public.workspace_members for insert to authenticated
with check (private.is_workspace_owner(workspace_id));
create policy workspace_members_update on public.workspace_members for update to authenticated
using (
  private.is_workspace_owner(workspace_id)
  and not private.is_canonical_workspace_owner(workspace_id, user_id)
)
with check (private.is_workspace_owner(workspace_id));
create policy workspace_members_delete on public.workspace_members for delete to authenticated
using (
  private.is_workspace_owner(workspace_id)
  and not private.is_canonical_workspace_owner(workspace_id, user_id)
);

create policy projects_select on public.projects for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy projects_insert on public.projects for insert to authenticated
with check (created_by = (select auth.uid()) and private.can_edit_workspace(workspace_id));
create policy projects_update on public.projects for update to authenticated
using (private.can_edit_workspace(workspace_id)) with check (private.can_edit_workspace(workspace_id));
create policy projects_delete on public.projects for delete to authenticated
using (private.can_edit_workspace(workspace_id));

create policy project_files_select on public.project_files for select to authenticated
using (private.can_view_project(project_id));
create policy project_files_insert on public.project_files for insert to authenticated
with check (created_by = (select auth.uid()) and private.can_edit_project(project_id));
create policy project_files_update on public.project_files for update to authenticated
using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));
create policy project_files_delete on public.project_files for delete to authenticated
using (private.can_edit_project(project_id));

create policy source_views_select on public.source_views for select to authenticated using (private.can_view_project(project_id));
create policy source_views_insert on public.source_views for insert to authenticated with check (private.can_edit_project(project_id));
create policy source_views_update on public.source_views for update to authenticated using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));
create policy source_views_delete on public.source_views for delete to authenticated using (private.can_edit_project(project_id));

create policy concepts_select on public.concepts for select to authenticated using (private.can_view_project(project_id));
create policy concepts_insert on public.concepts for insert to authenticated with check (created_by = (select auth.uid()) and private.can_edit_project(project_id));
create policy concepts_update on public.concepts for update to authenticated using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));
create policy concepts_delete on public.concepts for delete to authenticated using (private.can_edit_project(project_id));

create policy concept_versions_select on public.concept_versions for select to authenticated using (private.can_view_project(project_id));
create policy concept_versions_insert on public.concept_versions for insert to authenticated with check (private.can_edit_project(project_id));
create policy concept_versions_update on public.concept_versions for update to authenticated using (private.can_edit_project(project_id)) with check (private.can_edit_project(project_id));
create policy concept_versions_delete on public.concept_versions for delete to authenticated using (private.can_edit_project(project_id));

create policy generation_attempts_select on public.generation_attempts for select to authenticated using (private.can_view_project(project_id));
create policy generation_attempts_insert on public.generation_attempts for insert to authenticated with check (user_id = (select auth.uid()) and private.can_edit_project(project_id));
create policy generation_attempts_update on public.generation_attempts for update to authenticated using (user_id = (select auth.uid()) and private.can_edit_project(project_id)) with check (user_id = (select auth.uid()) and private.can_edit_project(project_id));

create policy concept_feedback_select on public.concept_feedback for select to authenticated using (private.can_view_project(project_id));
create policy concept_feedback_insert on public.concept_feedback for insert to authenticated with check (author_user_id = (select auth.uid()) and private.can_edit_project(project_id));
create policy concept_feedback_update on public.concept_feedback for update to authenticated using (author_user_id = (select auth.uid()) and private.can_edit_project(project_id)) with check (author_user_id = (select auth.uid()) and private.can_edit_project(project_id));
create policy concept_feedback_delete on public.concept_feedback for delete to authenticated using (author_user_id = (select auth.uid()) and private.can_edit_project(project_id));

create policy activity_events_select on public.activity_events for select to authenticated using (private.can_view_project(project_id));
create policy activity_events_insert on public.activity_events for insert to authenticated
with check (private.can_edit_project(project_id) and (actor_user_id is null or actor_user_id = (select auth.uid())));
create policy activity_events_update on public.activity_events for update to authenticated
using (private.can_edit_project(project_id) and (actor_user_id is null or actor_user_id = (select auth.uid())))
with check (private.can_edit_project(project_id) and (actor_user_id is null or actor_user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-assets',
  'project-assets',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy project_assets_select on storage.objects for select to authenticated
using (bucket_id = 'project-assets' and private.can_access_project_path(name, false));
create policy project_assets_insert on storage.objects for insert to authenticated
with check (bucket_id = 'project-assets' and private.can_access_project_path(name, true));
create policy project_assets_update on storage.objects for update to authenticated
using (bucket_id = 'project-assets' and private.can_access_project_path(name, true))
with check (bucket_id = 'project-assets' and private.can_access_project_path(name, true));
create policy project_assets_delete on storage.objects for delete to authenticated
using (bucket_id = 'project-assets' and private.can_access_project_path(name, true));

comment on table public.projects is 'Structured project source of truth; binaries live in private Storage.';
comment on column public.project_files.storage_path is 'Path format: <workspace_id>/<project_id>/<opaque_file_name>.';
