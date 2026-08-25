-- Localhost-only stubs for Import FX W1 read-security QA.
-- Mirrors production helpers: auth.uid, get_user_role, has_branch_access, user_branches.
-- Safe to re-run. Never applied to production by apply-import-fx-w1-local.mjs alone
-- unless host is localhost (guarded by that runner).

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.user_role', true), ''), 'user');
$$;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  auth_user_id uuid NULL,
  company_id uuid NULL,
  role text NULL
);

CREATE TABLE IF NOT EXISTS public.user_branches (
  user_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  is_default boolean DEFAULT false,
  PRIMARY KEY (user_id, branch_id)
);

CREATE OR REPLACE FUNCTION public.has_branch_access(branch_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_branches ub
    WHERE ub.branch_id = branch_uuid
      AND (
        ub.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = ub.user_id AND u.auth_user_id = auth.uid()
        )
      )
  );
$$;
