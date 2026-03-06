-- ============================================================================
-- MODULE-LEVEL VISIBILITY SCOPE (Generic for all ERP modules)
-- ============================================================================
-- Visibility is mutually exclusive per module: OWN | BRANCH | COMPANY.
-- Same logic for: sales, purchase, contacts, payments, ledger (journal_entries),
-- rentals, inventory (stock_movements), expenses, studio (studio_orders).
-- Priority: view_company > view_branch > view_own. No DB structure change.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SALES
-- ----------------------------------------------------------------------------
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_select_policy" ON public.sales;
CREATE POLICY "sales_select_policy" ON public.sales FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR (has_permission('sales', 'view_company'))
      OR (has_permission('sales', 'view_branch') AND NOT has_permission('sales', 'view_company')
          AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = sales.branch_id)))
      OR (has_permission('sales', 'view_own') AND NOT has_permission('sales', 'view_company') AND NOT has_permission('sales', 'view_branch') AND created_by = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 2. PURCHASES
-- ----------------------------------------------------------------------------
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purchases_select_company" ON public.purchases;
DROP POLICY IF EXISTS "purchases_select_policy" ON public.purchases;
CREATE POLICY "purchases_select_policy" ON public.purchases FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR (has_permission('purchase', 'view_company'))
      OR (has_permission('purchase', 'view_branch') AND NOT has_permission('purchase', 'view_company')
          AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = purchases.branch_id)))
      OR (has_permission('purchase', 'view_own') AND NOT has_permission('purchase', 'view_company') AND NOT has_permission('purchase', 'view_branch')
          AND (created_by IS NULL OR created_by = auth.uid()))
    )
  );

-- ----------------------------------------------------------------------------
-- 3. CONTACTS (contacts may not have branch_id in all schemas; view_branch = company)
-- ----------------------------------------------------------------------------
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts_select_policy" ON public.contacts;
CREATE POLICY "contacts_select_policy" ON public.contacts FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR (has_permission('contacts', 'view_company'))
      OR (has_permission('contacts', 'view_branch') AND NOT has_permission('contacts', 'view_company'))
      OR (has_permission('contacts', 'view_own') AND NOT has_permission('contacts', 'view_company') AND NOT has_permission('contacts', 'view_branch')
          AND (created_by = auth.uid() OR is_system_generated = true))
    )
  );

-- ----------------------------------------------------------------------------
-- 4. PAYMENTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_select_enterprise" ON public.payments;
CREATE POLICY "payments_select_enterprise" ON public.payments FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id()
    AND (
      is_owner_or_admin()
      OR (has_permission('payments', 'view_company'))
      OR (has_permission('payments', 'view_branch') AND NOT has_permission('payments', 'view_company')
          AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = payments.branch_id)))
      OR (has_permission('payments', 'view_own') AND NOT has_permission('payments', 'view_company') AND NOT has_permission('payments', 'view_branch')
          AND (created_by IS NULL OR created_by = auth.uid()))
    )
  );

-- ----------------------------------------------------------------------------
-- 5. JOURNAL ENTRIES (ledger)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journal_entries') THEN
    ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "journal_entries_select_enterprise" ON public.journal_entries;
    CREATE POLICY "journal_entries_select_enterprise" ON public.journal_entries FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR has_permission('ledger', 'view_full_accounting')
          OR (has_permission('ledger', 'view_company'))
          OR (has_permission('ledger', 'view_branch') AND NOT has_permission('ledger', 'view_company')
              AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = journal_entries.branch_id)))
          OR (has_permission('ledger', 'view_own') AND NOT has_permission('ledger', 'view_company') AND NOT has_permission('ledger', 'view_branch')
              AND (created_by IS NULL OR created_by = auth.uid()))
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. RENTALS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'rentals') THEN
    ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "rentals_select_enterprise" ON public.rentals;
    DROP POLICY IF EXISTS "rentals_select_company" ON public.rentals;
    CREATE POLICY "rentals_select_enterprise" ON public.rentals FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (has_permission('rentals', 'view_company'))
          OR (has_permission('rentals', 'view_branch') AND NOT has_permission('rentals', 'view_company')
              AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = rentals.branch_id)))
          OR (has_permission('rentals', 'view_own') AND NOT has_permission('rentals', 'view_company') AND NOT has_permission('rentals', 'view_branch')
              AND (created_by IS NULL OR created_by = auth.uid()))
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. STOCK MOVEMENTS (inventory)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stock_movements') THEN
    ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "stock_movements_select_admin" ON public.stock_movements;
    CREATE POLICY "stock_movements_select_admin" ON public.stock_movements FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (has_permission('inventory', 'view_company'))
          OR (has_permission('inventory', 'view_branch') AND NOT has_permission('inventory', 'view_company')
              AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = stock_movements.branch_id)))
          OR (has_permission('inventory', 'view_own') AND NOT has_permission('inventory', 'view_company') AND NOT has_permission('inventory', 'view_branch')
              AND (created_by IS NULL OR created_by = auth.uid()))
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. EXPENSES (if table exists)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expenses') THEN
    ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "expenses_select_company" ON public.expenses;
    CREATE POLICY "expenses_select_policy" ON public.expenses FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (has_permission('payments', 'view_company'))
          OR (has_permission('payments', 'view_branch') AND NOT has_permission('payments', 'view_company')
              AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = expenses.branch_id)))
          OR (has_permission('payments', 'view_own') AND NOT has_permission('payments', 'view_company') AND NOT has_permission('payments', 'view_branch')
              AND (created_by IS NULL OR created_by = auth.uid()))
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 9. STUDIO ORDERS (if table exists)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'studio_orders') THEN
    ALTER TABLE public.studio_orders ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "studio_orders_select_enterprise" ON public.studio_orders;
    DROP POLICY IF EXISTS "studio_orders_select_policy" ON public.studio_orders;
    CREATE POLICY "studio_orders_select_policy" ON public.studio_orders FOR SELECT TO authenticated
      USING (
        company_id = get_user_company_id()
        AND (
          is_owner_or_admin()
          OR (has_permission('studio', 'view_company'))
          OR (has_permission('studio', 'view_branch') AND NOT has_permission('studio', 'view_company')
              AND (branch_id IS NULL OR EXISTS (SELECT 1 FROM public.user_branches ub WHERE ub.user_id = auth.uid() AND ub.branch_id = studio_orders.branch_id)))
          OR (has_permission('studio', 'view_own') AND NOT has_permission('studio', 'view_company') AND NOT has_permission('studio', 'view_branch')
              AND (created_by IS NULL OR created_by = auth.uid()))
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 10. SEED: Add view_own/view_branch/view_company for new modules (one scope
--     per role: owner/admin=company, manager=branch, user=own). Sales already
--     in erp_permission_engine_v1.sql.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  m text;
  modules text[] := ARRAY['purchase','contacts','ledger','studio','rentals','payments','inventory'];
BEGIN
  FOREACH m IN ARRAY modules
  LOOP
    INSERT INTO public.role_permissions (role, module, action, allowed) VALUES
      ('owner', m, 'view_company', true), ('owner', m, 'view_branch', false), ('owner', m, 'view_own', false),
      ('admin', m, 'view_company', true), ('admin', m, 'view_branch', false), ('admin', m, 'view_own', false),
      ('manager', m, 'view_company', false), ('manager', m, 'view_branch', true), ('manager', m, 'view_own', false),
      ('user', m, 'view_company', false), ('user', m, 'view_branch', false), ('user', m, 'view_own', true)
    ON CONFLICT (role, module, action) DO NOTHING;
  END LOOP;
END $$;
