-- ============================================================================
-- RLS: Enable on purchases, rentals, expenses + company-scoped policies
-- Scoping: company_id from public.users (auth.uid() = users.id)
-- Applied via mcp_supabase_apply_migration 2026-02-14
-- ============================================================================

-- Step 1: Enable RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Step 2: Force RLS (recommended for production - prevents table owner bypass)
ALTER TABLE public.purchases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rentals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.expenses FORCE ROW LEVEL SECURITY;

-- Step 3: Purchases policies (company_id scoping)
DROP POLICY IF EXISTS "purchases_select_company" ON public.purchases;
CREATE POLICY "purchases_select_company"
ON public.purchases FOR SELECT TO authenticated
USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "purchases_insert_company" ON public.purchases;
CREATE POLICY "purchases_insert_company"
ON public.purchases FOR INSERT TO authenticated
WITH CHECK (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "purchases_update_company" ON public.purchases;
CREATE POLICY "purchases_update_company"
ON public.purchases FOR UPDATE TO authenticated
USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "purchases_delete_company" ON public.purchases;
CREATE POLICY "purchases_delete_company"
ON public.purchases FOR DELETE TO authenticated
USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

-- Step 4: Rentals policies (company_id scoping)
DROP POLICY IF EXISTS "rentals_select_company" ON public.rentals;
CREATE POLICY "rentals_select_company"
ON public.rentals FOR SELECT TO authenticated
USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "rentals_insert_company" ON public.rentals;
CREATE POLICY "rentals_insert_company"
ON public.rentals FOR INSERT TO authenticated
WITH CHECK (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "rentals_update_company" ON public.rentals;
CREATE POLICY "rentals_update_company"
ON public.rentals FOR UPDATE TO authenticated
USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "rentals_delete_company" ON public.rentals;
CREATE POLICY "rentals_delete_company"
ON public.rentals FOR DELETE TO authenticated
USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

-- Step 5: Expenses policies (company_id scoping)
DROP POLICY IF EXISTS "expenses_select_company" ON public.expenses;
CREATE POLICY "expenses_select_company"
ON public.expenses FOR SELECT TO authenticated
USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "expenses_insert_company" ON public.expenses;
CREATE POLICY "expenses_insert_company"
ON public.expenses FOR INSERT TO authenticated
WITH CHECK (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "expenses_update_company" ON public.expenses;
CREATE POLICY "expenses_update_company"
ON public.expenses FOR UPDATE TO authenticated
USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "expenses_delete_company" ON public.expenses;
CREATE POLICY "expenses_delete_company"
ON public.expenses FOR DELETE TO authenticated
USING (
  company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
);
