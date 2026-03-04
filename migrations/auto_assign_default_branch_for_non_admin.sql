-- ============================================================================
-- AUTO ASSIGN DEFAULT BRANCH FOR NON-ADMIN USERS
-- ============================================================================
-- When user_branches.user_id = public.users.id:
--   On INSERT into public.users (non-owner/admin), assign company default branch.
-- When user_branches.user_id = auth.users.id:
--   Use trigger on UPDATE when auth_user_id is set (invite flow).
-- This migration supports public.users.id FK; no duplicate rows.
-- ============================================================================

-- Helper: get default branch for a company (first active branch by id)
CREATE OR REPLACE FUNCTION public.get_company_default_branch_id(p_company_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.branches
  WHERE company_id = p_company_id AND (is_active IS NULL OR is_active = true)
  ORDER BY id ASC
  LIMIT 1;
$$;

-- Auto-assign: when a non-admin user is inserted and has no branches yet, add default branch.
-- Uses public.users.id for user_branches (if your FK is auth.users.id, use the second trigger block below).
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_default_branch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
  v_exists int;
BEGIN
  IF NEW.role IS NULL OR LOWER(TRIM(NEW.role::text)) IN ('owner', 'admin') THEN
    RETURN NEW;
  END IF;

  -- Already has at least one branch?
  SELECT 1 INTO v_exists FROM public.user_branches WHERE user_id = NEW.id LIMIT 1;
  IF v_exists = 1 THEN
    RETURN NEW;
  END IF;

  v_branch_id := public.get_company_default_branch_id(NEW.company_id);
  IF v_branch_id IS NOT NULL THEN
    INSERT INTO public.user_branches (user_id, branch_id, is_default)
    VALUES (NEW.id, v_branch_id, true)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_assign_default_branch_on_user_insert ON public.users;
CREATE TRIGGER auto_assign_default_branch_on_user_insert
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_assign_default_branch();

-- On UPDATE: when auth_user_id is set for the first time (e.g. after invite), assign default branch
-- if user_branches uses auth.users.id. Only runs when your FK is auth.users(id).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints c
    JOIN information_schema.constraint_column_usage u ON u.constraint_name = c.constraint_name
    WHERE c.table_schema = 'public' AND c.table_name = 'user_branches'
    AND u.table_schema = 'auth' AND u.table_name = 'users' AND u.column_name = 'id'
  ) THEN
    -- FK is to auth.users: assign branch when auth_user_id is set
    CREATE OR REPLACE FUNCTION public.trigger_auto_assign_default_branch_on_auth_link()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    DECLARE
      v_branch_id uuid;
      v_exists int;
    BEGIN
      IF NEW.auth_user_id IS NULL THEN RETURN NEW; END IF;
      IF OLD.auth_user_id IS NOT NULL THEN RETURN NEW; END IF;
      IF NEW.role IS NULL OR LOWER(TRIM(NEW.role::text)) IN ('owner', 'admin') THEN
        RETURN NEW;
      END IF;
      SELECT 1 INTO v_exists FROM public.user_branches WHERE user_id = NEW.auth_user_id LIMIT 1;
      IF v_exists = 1 THEN RETURN NEW; END IF;
      v_branch_id := public.get_company_default_branch_id(NEW.company_id);
      IF v_branch_id IS NOT NULL THEN
        INSERT INTO public.user_branches (user_id, branch_id, is_default)
        VALUES (NEW.auth_user_id, v_branch_id, true)
        ON CONFLICT DO NOTHING;
      END IF;
      RETURN NEW;
    EXCEPTION WHEN OTHERS THEN RETURN NEW;
    END;
    $fn$;
    DROP TRIGGER IF EXISTS auto_assign_default_branch_on_auth_link ON public.users;
    CREATE TRIGGER auto_assign_default_branch_on_auth_link
      AFTER UPDATE OF auth_user_id ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_auto_assign_default_branch_on_auth_link();
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- One-time backfill: users with no branches get company default (public.users.id variant)
INSERT INTO public.user_branches (user_id, branch_id, is_default)
SELECT u.id, b.id, true
FROM public.users u
CROSS JOIN LATERAL (
  SELECT id FROM public.branches
  WHERE company_id = u.company_id AND (is_active IS NULL OR is_active = true)
  ORDER BY id ASC
  LIMIT 1
) b
WHERE u.role IS NOT NULL AND LOWER(TRIM(u.role::text)) NOT IN ('owner', 'admin')
AND NOT EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = u.id);
