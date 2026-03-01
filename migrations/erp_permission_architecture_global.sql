-- ============================================================================
-- GLOBAL ERP PERMISSION ARCHITECTURE
-- Owner/Admin = full company visibility. User = branch-scoped. No created_by
-- filter in financial/ledger views. Ledger = customer-based (customer_id + company_id).
-- ============================================================================

-- Optional: add 'owner' to user_role enum so admin/owner both mean full company
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'owner';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Helper: true if current user is admin or owner (full company access)
-- Create only if function does not exist (avoids "must be owner" when run as pooler).
DO $outer$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE p.proname = 'is_admin_or_owner'
  ) THEN
    RAISE NOTICE 'is_admin_or_owner already exists, skipping create.';
    RETURN;
  END IF;
  EXECUTE $exec$
    CREATE FUNCTION public.is_admin_or_owner()
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    SET search_path = public
    AS $body$
      SELECT COALESCE(get_user_role()::text, '') IN ('admin', 'owner');
    $body$;
  $exec$;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping is_admin_or_owner create (may need DATABASE_ADMIN_URL).';
END $outer$;

-- ----------------------------------------------------------------------------
-- SALES: Admin/Owner = all; Manager = branch; Salesman = own sales only (created_by = auth.uid()) in assigned branch
-- ----------------------------------------------------------------------------
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select_enterprise" ON public.sales;
DROP POLICY IF EXISTS "sales_select_role_based" ON public.sales;
DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;
DROP POLICY IF EXISTS "rls_fix_company" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_enterprise" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_role_based" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_update_enterprise" ON public.sales;
DROP POLICY IF EXISTS "sales_update_role_based" ON public.sales;
DROP POLICY IF EXISTS "sales_update_policy" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_enterprise" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_role_based" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_policy" ON public.sales;

CREATE POLICY "sales_select_policy"
  ON public.sales FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (COALESCE(get_user_role()::text, '') IN ('manager', 'accountant') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
      OR (created_by = auth.uid() AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
    )
  );

CREATE POLICY "sales_insert_policy"
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (COALESCE(get_user_role()::text, '') IN ('manager', 'accountant') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id)))
      OR ((created_by IS NULL OR created_by = auth.uid()) AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id)))
    )
  );

CREATE POLICY "sales_update_policy"
  ON public.sales FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (COALESCE(get_user_role()::text, '') IN ('manager', 'accountant') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
      OR (created_by = auth.uid() AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
    )
  )
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "sales_delete_policy"
  ON public.sales FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (COALESCE(get_user_role()::text, '') IN ('manager', 'accountant') AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
      OR (created_by = auth.uid() AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
    )
  );

-- ----------------------------------------------------------------------------
-- PAYMENTS: Admin/Owner = company only; User = branch-scoped
-- ----------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_enterprise" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_enterprise" ON public.payments;
DROP POLICY IF EXISTS "payments_update_enterprise" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_enterprise" ON public.payments;

CREATE POLICY "payments_select_enterprise"
  ON public.payments FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = payments.branch_id))
    )
  );

CREATE POLICY "payments_insert_enterprise"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id))
    )
  );

CREATE POLICY "payments_update_enterprise"
  ON public.payments FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = payments.branch_id))
    )
  )
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "payments_delete_enterprise"
  ON public.payments FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = payments.branch_id))
    )
  );

-- ----------------------------------------------------------------------------
-- JOURNAL_ENTRIES: Admin/Owner = company only; User = branch-scoped
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journal_entries') THEN
    ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "journal_entries_select_enterprise" ON public.journal_entries;
    DROP POLICY IF EXISTS "journal_entries_insert_enterprise" ON public.journal_entries;
    DROP POLICY IF EXISTS "journal_entries_update_enterprise" ON public.journal_entries;
    DROP POLICY IF EXISTS "journal_entries_delete_enterprise" ON public.journal_entries;

    CREATE POLICY "journal_entries_select_enterprise"
      ON public.journal_entries FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = journal_entries.branch_id))
        )
      );

    CREATE POLICY "journal_entries_insert_enterprise"
      ON public.journal_entries FOR INSERT TO authenticated
      WITH CHECK (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id))
        )
      );

    CREATE POLICY "journal_entries_update_enterprise"
      ON public.journal_entries FOR UPDATE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = journal_entries.branch_id))
        )
      )
      WITH CHECK (company_id = get_user_company_id());

    CREATE POLICY "journal_entries_delete_enterprise"
      ON public.journal_entries FOR DELETE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = journal_entries.branch_id))
        )
      );
  END IF;

  -- journal_entry_lines: allow if parent journal_entry is visible (same company + admin or branch)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journal_entry_lines') THEN
    ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "journal_entry_lines_enterprise" ON public.journal_entry_lines;
    DROP POLICY IF EXISTS "Allow authenticated full access" ON public.journal_entry_lines;
    CREATE POLICY "journal_entry_lines_enterprise"
      ON public.journal_entry_lines FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.journal_entries je
          WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.company_id = get_user_company_id()
            AND (
              is_admin_or_owner()
              OR (je.branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = je.branch_id))
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.journal_entries je
          WHERE je.id = journal_entry_lines.journal_entry_id
            AND je.company_id = get_user_company_id()
            AND (
              is_admin_or_owner()
              OR (je.branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = je.branch_id))
            )
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- CONTACTS: Admin/Owner = full company; User = own + system (walk-in)
-- Never block walk-in from admin.
-- ----------------------------------------------------------------------------
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_select_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_select_enterprise" ON public.contacts;
DROP POLICY IF EXISTS "contacts_select_role_based" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert_enterprise" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update_enterprise" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_policy" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete_enterprise" ON public.contacts;

CREATE POLICY "contacts_select_policy"
  ON public.contacts FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR created_by = auth.uid()
      OR is_system_generated = true
    )
  );

CREATE POLICY "contacts_insert_policy"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "contacts_update_policy"
  ON public.contacts FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_admin_or_owner()
      OR created_by = auth.uid()
      OR is_system_generated = true
    )
  )
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "contacts_delete_policy"
  ON public.contacts FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (is_admin_or_owner() OR created_by = auth.uid())
    AND is_default = false
  );

-- ----------------------------------------------------------------------------
-- RENTALS: Admin/Owner = company only; User = branch-scoped
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rentals') THEN
    ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "rentals_select_enterprise" ON public.rentals;
    DROP POLICY IF EXISTS "rentals_insert_enterprise" ON public.rentals;
    DROP POLICY IF EXISTS "rentals_update_enterprise" ON public.rentals;
    DROP POLICY IF EXISTS "rentals_delete_enterprise" ON public.rentals;

    CREATE POLICY "rentals_select_enterprise"
      ON public.rentals FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = rentals.branch_id))
        )
      );
    CREATE POLICY "rentals_insert_enterprise"
      ON public.rentals FOR INSERT TO authenticated
      WITH CHECK (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id))
        )
      );
    CREATE POLICY "rentals_update_enterprise"
      ON public.rentals FOR UPDATE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = rentals.branch_id))
        )
      )
      WITH CHECK (company_id = get_user_company_id());
    CREATE POLICY "rentals_delete_enterprise"
      ON public.rentals FOR DELETE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = rentals.branch_id))
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STOCK_MOVEMENTS: Admin/Owner = company only; User = branch-scoped
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stock_movements') THEN
    ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "stock_movements_select_enterprise" ON public.stock_movements;
    DROP POLICY IF EXISTS "stock_movements_insert_enterprise" ON public.stock_movements;
    DROP POLICY IF EXISTS "stock_movements_update_enterprise" ON public.stock_movements;
    DROP POLICY IF EXISTS "stock_movements_delete_enterprise" ON public.stock_movements;
    DROP POLICY IF EXISTS "rls_fix_company" ON public.stock_movements;

    CREATE POLICY "stock_movements_select_enterprise"
      ON public.stock_movements FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = stock_movements.branch_id))
        )
      );

    CREATE POLICY "stock_movements_insert_enterprise"
      ON public.stock_movements FOR INSERT TO authenticated
      WITH CHECK (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = branch_id))
        )
      );

    CREATE POLICY "stock_movements_update_enterprise"
      ON public.stock_movements FOR UPDATE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = stock_movements.branch_id))
        )
      )
      WITH CHECK (company_id = get_user_company_id());

    CREATE POLICY "stock_movements_delete_enterprise"
      ON public.stock_movements FOR DELETE TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_admin_or_owner()
          OR (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = stock_movements.branch_id))
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- LEDGER_MASTER (if exists): company-scoped; all authenticated in company can read
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ledger_master') THEN
    ALTER TABLE public.ledger_master ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "ledger_master_select_enterprise" ON public.ledger_master;
    CREATE POLICY "ledger_master_select_enterprise"
      ON public.ledger_master FOR SELECT TO authenticated
      USING (company_id = get_user_company_id());
  END IF;
END $$;

DO $$ BEGIN
  EXECUTE 'COMMENT ON FUNCTION public.is_admin_or_owner() IS ''True if current user has admin or owner role (full company visibility). Used by RLS.''';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
