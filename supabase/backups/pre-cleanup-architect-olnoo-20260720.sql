-- Schema-only backup of the pre-existing (unrelated) legacy schema
-- found in Supabase project architect-olnoo (ref iaomlfkcbjeqpgnbpwxs)
-- before cleanup for Architect OLNOO's own migration.
-- Generated via SQL introspection (pg_dump unavailable: no Docker on this machine).
-- All 11 tables + auth.users confirmed at 0 rows at backup time (2026-07-20).
-- This file is for reference/recovery only; it is not meant to be re-run as-is.

-- ============ TABLE COLUMNS ============
-- table: design_briefs
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   project_id uuid NOT NULL
--   updated_by uuid NULL
--   total_area numeric(12,2) NULL
--   plot_area numeric(12,2) NULL
--   floors integer NULL
--   bedrooms integer NULL
--   bathrooms integer NULL
--   budget_min numeric(14,2) NULL
--   budget_max numeric(14,2) NULL
--   currency text NOT NULL DEFAULT 'RUB'::text
--   desired_start_date date NULL
--   desired_finish_date date NULL
--   requirements jsonb NOT NULL DEFAULT '{}'::jsonb
--   notes text NULL
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   updated_at timestamp with time zone NOT NULL DEFAULT now()

-- table: organization_members
--   organization_id uuid NOT NULL
--   user_id uuid NOT NULL
--   role text NOT NULL DEFAULT 'viewer'::text
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- table: organizations
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   name text NOT NULL
--   slug text NOT NULL
--   owner_id uuid NOT NULL
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   updated_at timestamp with time zone NOT NULL DEFAULT now()

-- table: profiles
--   id uuid NOT NULL
--   full_name text NULL
--   avatar_url text NULL
--   phone text NULL
--   company text NULL
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   updated_at timestamp with time zone NOT NULL DEFAULT now()

-- table: project_comments
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   project_id uuid NOT NULL
--   version_id uuid NULL
--   object_id uuid NULL
--   author_id uuid NOT NULL
--   body text NOT NULL
--   resolved_at timestamp with time zone NULL
--   resolved_by uuid NULL
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   updated_at timestamp with time zone NOT NULL DEFAULT now()

-- table: project_files
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   project_id uuid NOT NULL
--   version_id uuid NULL
--   object_id uuid NULL
--   uploaded_by uuid NOT NULL
--   storage_bucket text NOT NULL DEFAULT 'project-files'::text
--   storage_path text NOT NULL
--   file_name text NOT NULL
--   mime_type text NULL
--   file_size bigint NULL
--   category text NOT NULL DEFAULT 'document'::text
--   metadata jsonb NOT NULL DEFAULT '{}'::jsonb
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- table: project_members
--   project_id uuid NOT NULL
--   user_id uuid NOT NULL
--   role text NOT NULL DEFAULT 'viewer'::text
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- table: project_objects
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   project_id uuid NOT NULL
--   parent_id uuid NULL
--   object_type text NOT NULL
--   name text NOT NULL
--   description text NULL
--   sort_order integer NOT NULL DEFAULT 0
--   data jsonb NOT NULL DEFAULT '{}'::jsonb
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   updated_at timestamp with time zone NOT NULL DEFAULT now()

-- table: project_versions
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   project_id uuid NOT NULL
--   version_number integer NOT NULL
--   title text NOT NULL
--   description text NULL
--   status text NOT NULL DEFAULT 'draft'::text
--   created_by uuid NOT NULL
--   created_at timestamp with time zone NOT NULL DEFAULT now()

-- table: projects
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   organization_id uuid NOT NULL
--   created_by uuid NOT NULL
--   name text NOT NULL
--   project_type text NOT NULL DEFAULT 'house'::text
--   status text NOT NULL DEFAULT 'draft'::text
--   description text NULL
--   address text NULL
--   latitude numeric(9,6) NULL
--   longitude numeric(9,6) NULL
--   cover_url text NULL
--   metadata jsonb NOT NULL DEFAULT '{}'::jsonb
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   updated_at timestamp with time zone NOT NULL DEFAULT now()

-- table: tasks
--   id uuid NOT NULL DEFAULT gen_random_uuid()
--   project_id uuid NOT NULL
--   object_id uuid NULL
--   created_by uuid NOT NULL
--   assigned_to uuid NULL
--   title text NOT NULL
--   description text NULL
--   status text NOT NULL DEFAULT 'todo'::text
--   priority text NOT NULL DEFAULT 'normal'::text
--   due_date timestamp with time zone NULL
--   created_at timestamp with time zone NOT NULL DEFAULT now()
--   updated_at timestamp with time zone NOT NULL DEFAULT now()

-- ============ CONSTRAINTS (PK/UNIQUE/CHECK/FK) ============
-- design_briefs: design_briefs_updated_by_fkey (f) FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL
-- design_briefs: design_briefs_project_id_fkey (f) FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
-- design_briefs: design_briefs_pkey (p) PRIMARY KEY (id)
-- design_briefs: design_briefs_project_id_key (u) UNIQUE (project_id)
-- organization_members: organization_members_role_check (c) CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'architect'::text, 'designer'::text, 'client'::text, 'viewer'::text])))
-- organization_members: organization_members_user_id_fkey (f) FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
-- organization_members: organization_members_organization_id_fkey (f) FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
-- organization_members: organization_members_pkey (p) PRIMARY KEY (organization_id, user_id)
-- organizations: organizations_slug_format (c) CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))
-- organizations: organizations_owner_id_fkey (f) FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT
-- organizations: organizations_pkey (p) PRIMARY KEY (id)
-- profiles: profiles_id_fkey (f) FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
-- profiles: profiles_pkey (p) PRIMARY KEY (id)
-- project_comments: project_comments_body_check (c) CHECK ((length(TRIM(BOTH FROM body)) > 0))
-- project_comments: project_comments_object_id_fkey (f) FOREIGN KEY (object_id) REFERENCES project_objects(id) ON DELETE CASCADE
-- project_comments: project_comments_project_id_fkey (f) FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
-- project_comments: project_comments_author_id_fkey (f) FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE
-- project_comments: project_comments_resolved_by_fkey (f) FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL
-- project_comments: project_comments_version_id_fkey (f) FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
-- project_comments: project_comments_pkey (p) PRIMARY KEY (id)
-- project_files: project_files_file_size_check (c) CHECK (((file_size IS NULL) OR (file_size >= 0)))
-- project_files: project_files_category_check (c) CHECK ((category = ANY (ARRAY['drawing'::text, 'model'::text, 'render'::text, 'photo'::text, 'document'::text, 'contract'::text, 'other'::text])))
-- project_files: project_files_version_id_fkey (f) FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE SET NULL
-- project_files: project_files_object_id_fkey (f) FOREIGN KEY (object_id) REFERENCES project_objects(id) ON DELETE SET NULL
-- project_files: project_files_project_id_fkey (f) FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
-- project_files: project_files_uploaded_by_fkey (f) FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE RESTRICT
-- project_files: project_files_pkey (p) PRIMARY KEY (id)
-- project_files: project_files_storage_bucket_storage_path_key (u) UNIQUE (storage_bucket, storage_path)
-- project_members: project_members_role_check (c) CHECK ((role = ANY (ARRAY['manager'::text, 'architect'::text, 'designer'::text, 'client'::text, 'viewer'::text])))
-- project_members: project_members_user_id_fkey (f) FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
-- project_members: project_members_project_id_fkey (f) FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
-- project_members: project_members_pkey (p) PRIMARY KEY (project_id, user_id)
-- project_objects: project_objects_object_type_check (c) CHECK ((object_type = ANY (ARRAY['site'::text, 'settlement'::text, 'plot'::text, 'building'::text, 'house'::text, 'section'::text, 'floor'::text, 'room'::text, 'landscape'::text, 'other'::text])))
-- project_objects: project_objects_parent_id_fkey (f) FOREIGN KEY (parent_id) REFERENCES project_objects(id) ON DELETE CASCADE
-- project_objects: project_objects_project_id_fkey (f) FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
-- project_objects: project_objects_pkey (p) PRIMARY KEY (id)
-- project_versions: project_versions_status_check (c) CHECK ((status = ANY (ARRAY['draft'::text, 'review'::text, 'approved'::text, 'rejected'::text, 'superseded'::text])))
-- project_versions: project_versions_version_number_check (c) CHECK ((version_number > 0))
-- project_versions: project_versions_created_by_fkey (f) FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT
-- project_versions: project_versions_project_id_fkey (f) FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
-- project_versions: project_versions_pkey (p) PRIMARY KEY (id)
-- project_versions: project_versions_project_id_version_number_key (u) UNIQUE (project_id, version_number)
-- projects: projects_project_type_check (c) CHECK ((project_type = ANY (ARRAY['house'::text, 'settlement'::text, 'interior'::text, 'landscape'::text, 'other'::text])))
-- projects: projects_status_check (c) CHECK ((status = ANY (ARRAY['draft'::text, 'briefing'::text, 'concept'::text, 'design'::text, 'documentation'::text, 'construction'::text, 'completed'::text, 'archived'::text])))
-- projects: projects_created_by_fkey (f) FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT
-- projects: projects_organization_id_fkey (f) FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
-- projects: projects_pkey (p) PRIMARY KEY (id)
-- tasks: tasks_status_check (c) CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'review'::text, 'done'::text, 'cancelled'::text])))
-- tasks: tasks_priority_check (c) CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])))
-- tasks: tasks_object_id_fkey (f) FOREIGN KEY (object_id) REFERENCES project_objects(id) ON DELETE SET NULL
-- tasks: tasks_assigned_to_fkey (f) FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL
-- tasks: tasks_project_id_fkey (f) FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
-- tasks: tasks_created_by_fkey (f) FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT
-- tasks: tasks_pkey (p) PRIMARY KEY (id)

-- ============ INDEXES ============
CREATE UNIQUE INDEX design_briefs_pkey ON public.design_briefs USING btree (id);
CREATE UNIQUE INDEX design_briefs_project_id_key ON public.design_briefs USING btree (project_id);
CREATE UNIQUE INDEX organization_members_pkey ON public.organization_members USING btree (organization_id, user_id);
CREATE UNIQUE INDEX organizations_pkey ON public.organizations USING btree (id);
CREATE UNIQUE INDEX organizations_slug_unique ON public.organizations USING btree (lower(slug));
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX project_comments_pkey ON public.project_comments USING btree (id);
CREATE INDEX project_comments_project_idx ON public.project_comments USING btree (project_id);
CREATE UNIQUE INDEX project_files_pkey ON public.project_files USING btree (id);
CREATE UNIQUE INDEX project_files_storage_bucket_storage_path_key ON public.project_files USING btree (storage_bucket, storage_path);
CREATE INDEX project_files_project_idx ON public.project_files USING btree (project_id);
CREATE INDEX project_files_version_idx ON public.project_files USING btree (version_id);
CREATE UNIQUE INDEX project_members_pkey ON public.project_members USING btree (project_id, user_id);
CREATE UNIQUE INDEX project_objects_pkey ON public.project_objects USING btree (id);
CREATE INDEX project_objects_project_idx ON public.project_objects USING btree (project_id);
CREATE INDEX project_objects_parent_idx ON public.project_objects USING btree (parent_id);
CREATE UNIQUE INDEX project_versions_pkey ON public.project_versions USING btree (id);
CREATE UNIQUE INDEX project_versions_project_id_version_number_key ON public.project_versions USING btree (project_id, version_number);
CREATE INDEX project_versions_project_idx ON public.project_versions USING btree (project_id);
CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id);
CREATE INDEX projects_organization_idx ON public.projects USING btree (organization_id);
CREATE INDEX projects_status_idx ON public.projects USING btree (status);
CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id);
CREATE INDEX tasks_project_idx ON public.tasks USING btree (project_id);
CREATE INDEX tasks_assigned_idx ON public.tasks USING btree (assigned_to);

-- ============ RLS ENABLED FLAGS ============
-- design_briefs: rowsecurity=True forced=False
-- organization_members: rowsecurity=True forced=False
-- organizations: rowsecurity=True forced=False
-- profiles: rowsecurity=True forced=False
-- project_comments: rowsecurity=True forced=False
-- project_files: rowsecurity=True forced=False
-- project_members: rowsecurity=True forced=False
-- project_objects: rowsecurity=True forced=False
-- project_versions: rowsecurity=True forced=False
-- projects: rowsecurity=True forced=False
-- tasks: rowsecurity=True forced=False

-- ============ RLS POLICIES (public schema, legacy tables) ============
CREATE POLICY design_briefs_delete ON public.design_briefs FOR DELETE TO {authenticated}
  USING (can_manage_project(project_id))
;
CREATE POLICY design_briefs_insert ON public.design_briefs FOR INSERT TO {authenticated}
  WITH CHECK (can_manage_project(project_id))
;
CREATE POLICY design_briefs_select ON public.design_briefs FOR SELECT TO {authenticated}
  USING (is_project_member(project_id))
;
CREATE POLICY design_briefs_update ON public.design_briefs FOR UPDATE TO {authenticated}
  USING (can_manage_project(project_id))
  WITH CHECK (can_manage_project(project_id))
;
CREATE POLICY organization_members_delete ON public.organization_members FOR DELETE TO {authenticated}
  USING ((can_manage_org(organization_id) AND (role <> 'owner'::text)))
;
CREATE POLICY organization_members_insert ON public.organization_members FOR INSERT TO {authenticated}
  WITH CHECK (can_manage_org(organization_id))
;
CREATE POLICY organization_members_select ON public.organization_members FOR SELECT TO {authenticated}
  USING (is_org_member(organization_id))
;
CREATE POLICY organization_members_update ON public.organization_members FOR UPDATE TO {authenticated}
  USING (can_manage_org(organization_id))
  WITH CHECK (can_manage_org(organization_id))
;
CREATE POLICY organizations_delete ON public.organizations FOR DELETE TO {authenticated}
  USING ((owner_id = auth.uid()))
;
CREATE POLICY organizations_insert ON public.organizations FOR INSERT TO {authenticated}
  WITH CHECK ((owner_id = auth.uid()))
;
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO {authenticated}
  USING (is_org_member(id))
;
CREATE POLICY organizations_update ON public.organizations FOR UPDATE TO {authenticated}
  USING (can_manage_org(id))
  WITH CHECK (can_manage_org(id))
;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO {authenticated}
  USING (shares_org(id))
;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO {authenticated}
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()))
;
CREATE POLICY project_comments_delete ON public.project_comments FOR DELETE TO {authenticated}
  USING (((author_id = auth.uid()) OR can_manage_project(project_id)))
;
CREATE POLICY project_comments_insert ON public.project_comments FOR INSERT TO {authenticated}
  WITH CHECK (((author_id = auth.uid()) AND is_project_member(project_id)))
;
CREATE POLICY project_comments_select ON public.project_comments FOR SELECT TO {authenticated}
  USING (is_project_member(project_id))
;
CREATE POLICY project_comments_update ON public.project_comments FOR UPDATE TO {authenticated}
  USING (((author_id = auth.uid()) OR can_manage_project(project_id)))
  WITH CHECK (is_project_member(project_id))
;
CREATE POLICY project_files_delete ON public.project_files FOR DELETE TO {authenticated}
  USING (((uploaded_by = auth.uid()) OR can_manage_project(project_id)))
;
CREATE POLICY project_files_insert ON public.project_files FOR INSERT TO {authenticated}
  WITH CHECK (((uploaded_by = auth.uid()) AND is_project_member(project_id)))
;
CREATE POLICY project_files_select ON public.project_files FOR SELECT TO {authenticated}
  USING (is_project_member(project_id))
;
CREATE POLICY project_files_update ON public.project_files FOR UPDATE TO {authenticated}
  USING (((uploaded_by = auth.uid()) OR can_manage_project(project_id)))
  WITH CHECK (is_project_member(project_id))
;
CREATE POLICY project_members_delete ON public.project_members FOR DELETE TO {authenticated}
  USING (can_manage_project(project_id))
;
CREATE POLICY project_members_insert ON public.project_members FOR INSERT TO {authenticated}
  WITH CHECK (can_manage_project(project_id))
;
CREATE POLICY project_members_select ON public.project_members FOR SELECT TO {authenticated}
  USING (is_project_member(project_id))
;
CREATE POLICY project_members_update ON public.project_members FOR UPDATE TO {authenticated}
  USING (can_manage_project(project_id))
  WITH CHECK (can_manage_project(project_id))
;
CREATE POLICY project_objects_delete ON public.project_objects FOR DELETE TO {authenticated}
  USING (can_manage_project(project_id))
;
CREATE POLICY project_objects_insert ON public.project_objects FOR INSERT TO {authenticated}
  WITH CHECK (can_manage_project(project_id))
;
CREATE POLICY project_objects_select ON public.project_objects FOR SELECT TO {authenticated}
  USING (is_project_member(project_id))
;
CREATE POLICY project_objects_update ON public.project_objects FOR UPDATE TO {authenticated}
  USING (can_manage_project(project_id))
  WITH CHECK (can_manage_project(project_id))
;
CREATE POLICY project_versions_delete ON public.project_versions FOR DELETE TO {authenticated}
  USING (can_manage_project(project_id))
;
CREATE POLICY project_versions_insert ON public.project_versions FOR INSERT TO {authenticated}
  WITH CHECK (((created_by = auth.uid()) AND can_manage_project(project_id)))
;
CREATE POLICY project_versions_select ON public.project_versions FOR SELECT TO {authenticated}
  USING (is_project_member(project_id))
;
CREATE POLICY project_versions_update ON public.project_versions FOR UPDATE TO {authenticated}
  USING (can_manage_project(project_id))
  WITH CHECK (can_manage_project(project_id))
;
CREATE POLICY projects_delete ON public.projects FOR DELETE TO {authenticated}
  USING (can_manage_project(id))
;
CREATE POLICY projects_insert ON public.projects FOR INSERT TO {authenticated}
  WITH CHECK (((created_by = auth.uid()) AND can_create_project(organization_id)))
;
CREATE POLICY projects_select ON public.projects FOR SELECT TO {authenticated}
  USING (is_project_member(id))
;
CREATE POLICY projects_update ON public.projects FOR UPDATE TO {authenticated}
  USING (can_manage_project(id))
  WITH CHECK (can_manage_project(id))
;
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO {authenticated}
  USING (((created_by = auth.uid()) OR can_manage_project(project_id)))
;
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO {authenticated}
  WITH CHECK (((created_by = auth.uid()) AND is_project_member(project_id)))
;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO {authenticated}
  USING (is_project_member(project_id))
;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO {authenticated}
  USING (((created_by = auth.uid()) OR (assigned_to = auth.uid()) OR can_manage_project(project_id)))
  WITH CHECK (is_project_member(project_id))
;

-- ============ GRANTS to anon/authenticated ============
-- GRANT INSERT ON design_briefs TO anon
-- GRANT SELECT ON design_briefs TO anon
-- GRANT UPDATE ON design_briefs TO anon
-- GRANT DELETE ON design_briefs TO anon
-- GRANT TRUNCATE ON design_briefs TO anon
-- GRANT REFERENCES ON design_briefs TO anon
-- GRANT TRIGGER ON design_briefs TO anon
-- GRANT SELECT ON design_briefs TO authenticated
-- GRANT INSERT ON design_briefs TO authenticated
-- GRANT TRIGGER ON design_briefs TO authenticated
-- GRANT REFERENCES ON design_briefs TO authenticated
-- GRANT TRUNCATE ON design_briefs TO authenticated
-- GRANT DELETE ON design_briefs TO authenticated
-- GRANT UPDATE ON design_briefs TO authenticated
-- GRANT INSERT ON organization_members TO anon
-- GRANT TRIGGER ON organization_members TO anon
-- GRANT REFERENCES ON organization_members TO anon
-- GRANT TRUNCATE ON organization_members TO anon
-- GRANT DELETE ON organization_members TO anon
-- GRANT UPDATE ON organization_members TO anon
-- GRANT SELECT ON organization_members TO anon
-- GRANT SELECT ON organization_members TO authenticated
-- GRANT TRIGGER ON organization_members TO authenticated
-- GRANT REFERENCES ON organization_members TO authenticated
-- GRANT TRUNCATE ON organization_members TO authenticated
-- GRANT DELETE ON organization_members TO authenticated
-- GRANT UPDATE ON organization_members TO authenticated
-- GRANT INSERT ON organization_members TO authenticated
-- GRANT REFERENCES ON organizations TO anon
-- GRANT SELECT ON organizations TO anon
-- GRANT UPDATE ON organizations TO anon
-- GRANT DELETE ON organizations TO anon
-- GRANT TRUNCATE ON organizations TO anon
-- GRANT INSERT ON organizations TO anon
-- GRANT TRIGGER ON organizations TO anon
-- GRANT TRIGGER ON organizations TO authenticated
-- GRANT REFERENCES ON organizations TO authenticated
-- GRANT TRUNCATE ON organizations TO authenticated
-- GRANT DELETE ON organizations TO authenticated
-- GRANT UPDATE ON organizations TO authenticated
-- GRANT SELECT ON organizations TO authenticated
-- GRANT INSERT ON organizations TO authenticated
-- GRANT SELECT ON profiles TO anon
-- GRANT INSERT ON profiles TO anon
-- GRANT UPDATE ON profiles TO anon
-- GRANT DELETE ON profiles TO anon
-- GRANT TRUNCATE ON profiles TO anon
-- GRANT REFERENCES ON profiles TO anon
-- GRANT TRIGGER ON profiles TO anon
-- GRANT TRIGGER ON profiles TO authenticated
-- GRANT REFERENCES ON profiles TO authenticated
-- GRANT TRUNCATE ON profiles TO authenticated
-- GRANT DELETE ON profiles TO authenticated
-- GRANT UPDATE ON profiles TO authenticated
-- GRANT SELECT ON profiles TO authenticated
-- GRANT INSERT ON profiles TO authenticated
-- GRANT SELECT ON project_comments TO anon
-- GRANT INSERT ON project_comments TO anon
-- GRANT TRIGGER ON project_comments TO anon
-- GRANT REFERENCES ON project_comments TO anon
-- GRANT TRUNCATE ON project_comments TO anon
-- GRANT DELETE ON project_comments TO anon
-- GRANT UPDATE ON project_comments TO anon
-- GRANT INSERT ON project_comments TO authenticated
-- GRANT TRIGGER ON project_comments TO authenticated
-- GRANT REFERENCES ON project_comments TO authenticated
-- GRANT TRUNCATE ON project_comments TO authenticated
-- GRANT DELETE ON project_comments TO authenticated
-- GRANT UPDATE ON project_comments TO authenticated
-- GRANT SELECT ON project_comments TO authenticated
-- GRANT TRIGGER ON project_files TO anon
-- GRANT SELECT ON project_files TO anon
-- GRANT UPDATE ON project_files TO anon
-- GRANT DELETE ON project_files TO anon
-- GRANT TRUNCATE ON project_files TO anon
-- GRANT REFERENCES ON project_files TO anon
-- GRANT INSERT ON project_files TO anon
-- GRANT TRIGGER ON project_files TO authenticated
-- GRANT INSERT ON project_files TO authenticated
-- GRANT SELECT ON project_files TO authenticated
-- GRANT UPDATE ON project_files TO authenticated
-- GRANT DELETE ON project_files TO authenticated
-- GRANT TRUNCATE ON project_files TO authenticated
-- GRANT REFERENCES ON project_files TO authenticated
-- GRANT INSERT ON project_members TO anon
-- GRANT SELECT ON project_members TO anon
-- GRANT UPDATE ON project_members TO anon
-- GRANT DELETE ON project_members TO anon
-- GRANT TRUNCATE ON project_members TO anon
-- GRANT REFERENCES ON project_members TO anon
-- GRANT TRIGGER ON project_members TO anon
-- GRANT INSERT ON project_members TO authenticated
-- GRANT SELECT ON project_members TO authenticated
-- GRANT UPDATE ON project_members TO authenticated
-- GRANT DELETE ON project_members TO authenticated
-- GRANT TRUNCATE ON project_members TO authenticated
-- GRANT REFERENCES ON project_members TO authenticated
-- GRANT TRIGGER ON project_members TO authenticated
-- GRANT INSERT ON project_objects TO anon
-- GRANT SELECT ON project_objects TO anon
-- GRANT UPDATE ON project_objects TO anon
-- GRANT DELETE ON project_objects TO anon
-- GRANT TRUNCATE ON project_objects TO anon
-- GRANT REFERENCES ON project_objects TO anon
-- GRANT TRIGGER ON project_objects TO anon
-- GRANT INSERT ON project_objects TO authenticated
-- GRANT SELECT ON project_objects TO authenticated
-- GRANT UPDATE ON project_objects TO authenticated
-- GRANT DELETE ON project_objects TO authenticated
-- GRANT TRUNCATE ON project_objects TO authenticated
-- GRANT REFERENCES ON project_objects TO authenticated
-- GRANT TRIGGER ON project_objects TO authenticated
-- GRANT SELECT ON project_versions TO anon
-- GRANT INSERT ON project_versions TO anon
-- GRANT UPDATE ON project_versions TO anon
-- GRANT DELETE ON project_versions TO anon
-- GRANT TRUNCATE ON project_versions TO anon
-- GRANT REFERENCES ON project_versions TO anon
-- GRANT TRIGGER ON project_versions TO anon
-- GRANT INSERT ON project_versions TO authenticated
-- GRANT TRIGGER ON project_versions TO authenticated
-- GRANT REFERENCES ON project_versions TO authenticated
-- GRANT TRUNCATE ON project_versions TO authenticated
-- GRANT DELETE ON project_versions TO authenticated
-- GRANT UPDATE ON project_versions TO authenticated
-- GRANT SELECT ON project_versions TO authenticated
-- GRANT SELECT ON projects TO anon
-- GRANT TRIGGER ON projects TO anon
-- GRANT REFERENCES ON projects TO anon
-- GRANT TRUNCATE ON projects TO anon
-- GRANT DELETE ON projects TO anon
-- GRANT UPDATE ON projects TO anon
-- GRANT INSERT ON projects TO anon
-- GRANT SELECT ON projects TO authenticated
-- GRANT INSERT ON projects TO authenticated
-- GRANT UPDATE ON projects TO authenticated
-- GRANT DELETE ON projects TO authenticated
-- GRANT TRUNCATE ON projects TO authenticated
-- GRANT REFERENCES ON projects TO authenticated
-- GRANT TRIGGER ON projects TO authenticated
-- GRANT INSERT ON tasks TO anon
-- GRANT TRIGGER ON tasks TO anon
-- GRANT REFERENCES ON tasks TO anon
-- GRANT TRUNCATE ON tasks TO anon
-- GRANT DELETE ON tasks TO anon
-- GRANT UPDATE ON tasks TO anon
-- GRANT SELECT ON tasks TO anon
-- GRANT TRIGGER ON tasks TO authenticated
-- GRANT SELECT ON tasks TO authenticated
-- GRANT UPDATE ON tasks TO authenticated
-- GRANT DELETE ON tasks TO authenticated
-- GRANT TRUNCATE ON tasks TO authenticated
-- GRANT REFERENCES ON tasks TO authenticated
-- GRANT INSERT ON tasks TO authenticated

-- ============ FUNCTIONS (full definitions) ============
CREATE OR REPLACE FUNCTION public.can_create_project(target_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and exists (
    select 1 from public.organization_members
    where organization_id = target_org
      and user_id = auth.uid()
      and role in ('owner','admin','architect','designer')
  );
$function$


CREATE OR REPLACE FUNCTION public.can_manage_org(target_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and exists (
    select 1 from public.organization_members
    where organization_id = target_org
      and user_id = auth.uid()
      and role in ('owner','admin')
  );
$function$


CREATE OR REPLACE FUNCTION public.can_manage_project(target_project uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and (
    exists (
      select 1
      from public.projects p
      join public.organization_members om on om.organization_id = p.organization_id
      where p.id = target_project
        and om.user_id = auth.uid()
        and om.role in ('owner','admin')
    )
    or exists (
      select 1 from public.project_members
      where project_id = target_project
        and user_id = auth.uid()
        and role in ('manager','architect')
    )
  );
$function$


CREATE OR REPLACE FUNCTION public.handle_new_organization()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (organization_id, user_id) do update set role = 'owner';
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.is_org_member(target_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and exists (
    select 1 from public.organization_members
    where organization_id = target_org and user_id = auth.uid()
  );
$function$


CREATE OR REPLACE FUNCTION public.is_project_member(target_project uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and (
    exists (
      select 1 from public.project_members
      where project_id = target_project and user_id = auth.uid()
    )
    or exists (
      select 1
      from public.projects p
      join public.organization_members om on om.organization_id = p.organization_id
      where p.id = target_project
        and om.user_id = auth.uid()
        and om.role in ('owner','admin','architect','designer')
    )
  );
$function$


CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.shares_org(other_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and (
    other_user = auth.uid()
    or exists (
      select 1
      from public.organization_members mine
      join public.organization_members theirs
        on theirs.organization_id = mine.organization_id
      where mine.user_id = auth.uid() and theirs.user_id = other_user
    )
  );
$function$


CREATE OR REPLACE FUNCTION public.try_uuid(value text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
begin
  return value::uuid;
exception when others then
  return null;
end;
$function$

