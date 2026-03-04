-- ============================================================================
-- AUDIT-READY: purchase_charges & sale_charges (per-line, traceable)
-- ============================================================================
-- Goal: No aggregated totals without detail rows. Each charge (freight, loading,
-- discount, stitching, etc.) is one row with ledger_account_id for proper
-- double-entry. Header tables keep summary columns for display only; accounting
-- uses detail rows.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. purchase_charges: one row per charge type per purchase
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  charge_type TEXT NOT NULL,
  ledger_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT purchase_charges_amount_non_neg CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_charges_purchase ON public.purchase_charges(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_charges_type ON public.purchase_charges(charge_type);
COMMENT ON TABLE public.purchase_charges IS 'Per-purchase charge lines (freight, loading, discount, etc.) for audit-ready ledger entries.';

-- ----------------------------------------------------------------------------
-- 2. sale_charges: one row per charge type per sale
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  charge_type TEXT NOT NULL,
  ledger_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sale_charges_amount_non_neg CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_charges_sale ON public.sale_charges(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_charges_type ON public.sale_charges(charge_type);
COMMENT ON TABLE public.sale_charges IS 'Per-sale charge lines (freight, discount, etc.) for audit-ready ledger entries.';

-- ----------------------------------------------------------------------------
-- 3a. Optional: drop discount_percentage from purchases if it exists
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE public.purchases DROP COLUMN discount_percentage;
    RAISE NOTICE 'Dropped purchases.discount_percentage (use discount_amount / purchase_charges).';
  END IF;
END $$;

-- 3b. Ensure purchase_items has discount_amount/tax_amount (add if only discount/tax exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_items' AND column_name = 'discount_amount') THEN
    ALTER TABLE public.purchase_items ADD COLUMN discount_amount DECIMAL(15,2) DEFAULT 0;
    RAISE NOTICE 'Added purchase_items.discount_amount.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_items' AND column_name = 'tax_amount') THEN
    ALTER TABLE public.purchase_items ADD COLUMN tax_amount DECIMAL(15,2) DEFAULT 0;
    RAISE NOTICE 'Added purchase_items.tax_amount.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. RLS (optional): allow same visibility as parent table
-- ----------------------------------------------------------------------------
ALTER TABLE public.purchase_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_charges_select_via_purchase" ON public.purchase_charges;
CREATE POLICY "purchase_charges_select_via_purchase"
  ON public.purchase_charges FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_charges.purchase_id
      AND p.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "purchase_charges_insert_via_purchase" ON public.purchase_charges;
CREATE POLICY "purchase_charges_insert_via_purchase"
  ON public.purchase_charges FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_charges.purchase_id
      AND p.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "purchase_charges_update_via_purchase" ON public.purchase_charges;
CREATE POLICY "purchase_charges_update_via_purchase"
  ON public.purchase_charges FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_charges.purchase_id
      AND p.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "purchase_charges_delete_via_purchase" ON public.purchase_charges;
CREATE POLICY "purchase_charges_delete_via_purchase"
  ON public.purchase_charges FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_charges.purchase_id
      AND p.company_id = get_user_company_id()
    )
  );

-- sale_charges RLS
DROP POLICY IF EXISTS "sale_charges_select_via_sale" ON public.sale_charges;
CREATE POLICY "sale_charges_select_via_sale"
  ON public.sale_charges FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_charges.sale_id
      AND s.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "sale_charges_insert_via_sale" ON public.sale_charges;
CREATE POLICY "sale_charges_insert_via_sale"
  ON public.sale_charges FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_charges.sale_id
      AND s.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "sale_charges_update_via_sale" ON public.sale_charges;
CREATE POLICY "sale_charges_update_via_sale"
  ON public.sale_charges FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_charges.sale_id
      AND s.company_id = get_user_company_id()
    )
  );

DROP POLICY IF EXISTS "sale_charges_delete_via_sale" ON public.sale_charges;
CREATE POLICY "sale_charges_delete_via_sale"
  ON public.sale_charges FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_charges.sale_id
      AND s.company_id = get_user_company_id()
    )
  );

-- ============================================================================
-- Accounting: Create journal lines from purchase_charges / sale_charges (detail
-- rows), not from header totals. Implement in app/accountingService or RPC.
-- Example for purchase_charges:
--   Freight: Dr Inventory/Expense (ledger_account_id), Cr Supplier
--   Discount: Dr Supplier, Cr Discount Received (ledger_account_id)
-- ============================================================================
