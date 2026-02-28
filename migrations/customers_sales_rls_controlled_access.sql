-- ============================================================================
-- CUSTOMERS & SALES CONTROLLED ACCESS
-- ============================================================================
-- Business rules:
--   Customers (contacts type=customer):
--     - One default "Walk-in Customer" per branch; auto-created; cannot delete
--     - Admin: all | Manager: branch | Salesman: own + default
--   Sales:
--     - created_by = auth.uid(); salesman cannot change; RLS enforces
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Add is_default to contacts
-- ----------------------------------------------------------------------------
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN public.contacts.is_default IS 'True for Walk-in Customer; cannot be deleted';

-- Backfill: set is_default for ONE walking customer per company (unique index allows only one default per company)
UPDATE public.contacts c
SET is_default = true
FROM (
  SELECT DISTINCT ON (company_id) id
  FROM public.contacts
  WHERE (system_type = 'walking_customer' OR (is_system_generated = true AND name ILIKE '%walk-in%'))
    AND type = 'customer'
  ORDER BY company_id, id
) sub
WHERE c.id = sub.id AND (c.is_default IS NOT TRUE);

-- ----------------------------------------------------------------------------
-- STEP 2: Helper - resolve public user id for current auth user
-- (Skip if not owner - e.g. when using DATABASE_URL; use DATABASE_ADMIN_URL to own)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION public.get_user_public_id()
  RETURNS UUID
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
  AS $body$
    SELECT COALESCE(
      (SELECT id FROM public.users WHERE id = auth.uid() LIMIT 1),
      (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
    );
  $body$;
EXCEPTION
  WHEN insufficient_privilege THEN NULL; -- not owner, function may already exist
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%must be owner%' OR SQLERRM LIKE '%permission denied%' THEN
      NULL; -- skip so rest of migration can run
    ELSE
      RAISE;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 3: Contacts RLS - drop existing policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rls_fix_company" ON public.contacts;
DROP POLICY IF EXISTS "Users can view company contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete contacts" ON public.contacts;
DROP POLICY IF EXISTS "contacts_select_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_select_role_based" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_role_based" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_role_based" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_role_based" ON public.contacts;

-- ----------------------------------------------------------------------------
-- STEP 4: Contacts RLS - role-based (customers + suppliers + workers)
-- For customers: Admin=all, Manager=branch, Salesman=own+default
-- For suppliers/workers: same company visibility (simplified)
-- ----------------------------------------------------------------------------
CREATE POLICY "contacts_select_role_based"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (branch_id IS NULL OR branch_id = get_user_branch_id()))
      OR (
        get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator')
        AND (
          type != 'customer'
          OR is_default = true
          OR created_by = auth.uid()
          OR created_by = get_user_public_id()
          OR (created_by IS NULL AND branch_id = get_user_branch_id())
        )
      )
      OR (
        get_user_role() NOT IN ('admin', 'manager')
        AND (
          type != 'customer'
          OR is_default = true
          OR created_by = auth.uid()
          OR created_by = get_user_public_id()
          OR (created_by IS NULL AND branch_id = get_user_branch_id())
        )
      )
    )
  );

CREATE POLICY "contacts_insert_role_based"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (branch_id IS NULL OR branch_id = get_user_branch_id()))
      OR (get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator') AND (branch_id IS NULL OR branch_id = get_user_branch_id()))
      OR (get_user_role() NOT IN ('admin', 'manager') AND (branch_id IS NULL OR branch_id = get_user_branch_id()))
    )
  );

CREATE POLICY "contacts_update_role_based"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (branch_id IS NULL OR branch_id = get_user_branch_id()))
      OR (
        get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator')
        AND (
          type != 'customer'
          OR is_default = true
          OR created_by = auth.uid()
          OR created_by = get_user_public_id()
          OR (created_by IS NULL AND branch_id = get_user_branch_id())
        )
      )
      OR (
        get_user_role() NOT IN ('admin', 'manager')
        AND (
          type != 'customer'
          OR is_default = true
          OR created_by = auth.uid()
          OR created_by = get_user_public_id()
          OR (created_by IS NULL AND branch_id = get_user_branch_id())
        )
      )
    )
  );

-- DELETE: same visibility + block deletion of default customer
CREATE POLICY "contacts_delete_role_based"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (
    company_id = get_user_company_id()
    AND is_default = false
    AND (
      get_user_role() = 'admin'
      OR (get_user_role() = 'manager' AND (branch_id IS NULL OR branch_id = get_user_branch_id()))
      OR (
        get_user_role() IN ('salesman', 'staff', 'cashier', 'inventory', 'operator')
        AND (
          type != 'customer'
          OR created_by = auth.uid()
          OR created_by = get_user_public_id()
          OR (created_by IS NULL AND branch_id = get_user_branch_id())
        )
      )
      OR (
        get_user_role() NOT IN ('admin', 'manager')
        AND (
          type != 'customer'
          OR created_by = auth.uid()
          OR created_by = get_user_public_id()
          OR (created_by IS NULL AND branch_id = get_user_branch_id())
        )
      )
    )
  );

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Prevent soft-delete (is_active = false) of default customer (skip if not owner)
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION public.contacts_protect_default_customer()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  BEGIN
    IF TG_OP = 'UPDATE' AND OLD.is_default = true AND NEW.is_active = false THEN
      RAISE EXCEPTION 'Default Walk-in Customer cannot be deleted or deactivated.';
    END IF;
    RETURN NEW;
  END;
  $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

DROP TRIGGER IF EXISTS contacts_protect_default_customer_trigger ON public.contacts;
CREATE TRIGGER contacts_protect_default_customer_trigger
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.contacts_protect_default_customer();

-- ----------------------------------------------------------------------------
-- STEP 5: Auto-create default Walk-in Customer when branch is created (skip if not owner)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION public.create_default_walking_customer_for_branch()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  BEGIN
    -- Only one default per company (unique index idx_contacts_one_default_per_company)
    IF NOT EXISTS (
      SELECT 1 FROM public.contacts
      WHERE company_id = NEW.company_id AND type = 'customer' AND is_default = true
    ) THEN
      INSERT INTO public.contacts (
        company_id, branch_id, type, name, is_active, is_system_generated, system_type, is_default,
        opening_balance, credit_limit, payment_terms
      ) VALUES (
        NEW.company_id, NEW.id, 'customer', 'Walk-in Customer', true, true, 'walking_customer', true,
        0, 0, 0
      );
    END IF;
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'create_default_walking_customer_for_branch: %', SQLERRM;
    RETURN NEW;
  END;
  $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_create_default_walking_customer ON public.branches;
CREATE TRIGGER trigger_create_default_walking_customer
  AFTER INSERT ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_walking_customer_for_branch();

-- Backfill: one default walking customer per company only (idx_contacts_one_default_per_company is unique on company_id)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.id AS company_id
    FROM public.companies c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.contacts ct
      WHERE ct.company_id = c.id AND ct.type = 'customer' AND ct.is_default = true
    )
  LOOP
    INSERT INTO public.contacts (
      company_id, branch_id, type, name, is_active, is_system_generated, system_type, is_default,
      opening_balance, credit_limit, payment_terms
    ) VALUES (
      r.company_id, NULL, 'customer', 'Walk-in Customer', true, true, 'walking_customer', true,
      0, 0, 0
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 6: Sales - prevent non-admin from changing created_by on UPDATE (skip if not owner)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION public.sales_protect_created_by()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $fn$
  BEGIN
    IF TG_OP = 'UPDATE' AND OLD.created_by IS DISTINCT FROM NEW.created_by THEN
      IF get_user_role() != 'admin' THEN
        NEW.created_by := OLD.created_by;
      END IF;
    END IF;
    RETURN NEW;
  END;
  $fn$;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%must be owner%' AND SQLERRM NOT LIKE '%permission denied%' THEN RAISE; END IF;
END $$;

DROP TRIGGER IF EXISTS sales_protect_created_by_trigger ON public.sales;
CREATE TRIGGER sales_protect_created_by_trigger
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_protect_created_by();
