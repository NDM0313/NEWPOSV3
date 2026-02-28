-- ============================================================================
-- WALK-IN CUSTOMER CONSOLIDATION & DATA FIX
-- 1) Only ONE walk-in per company.
-- 2) All sales (and related tables) reference that single walk-in.
-- 3) Extra walk-ins merged then deleted (reassign first, delete last).
-- 4) CUS-0000 reserved; unique index enforces single system walk-in per company.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PHASE 1 & 2: Identify primary walk-in per company (oldest by created_at)
--              and reassign all references from duplicates to primary.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r_company RECORD;
  v_primary_id UUID;
  v_dup_id UUID;
  v_duplicate_ids UUID[];
BEGIN
  FOR r_company IN
    SELECT company_id
    FROM public.contacts
    WHERE type IN ('customer', 'both')
      AND (is_system_generated = true OR system_type = 'walking_customer' OR is_default = true)
    GROUP BY company_id
    HAVING COUNT(*) > 1
  LOOP
    -- Primary = oldest walk-in for this company
    SELECT id INTO v_primary_id
    FROM public.contacts
    WHERE company_id = r_company.company_id
      AND type IN ('customer', 'both')
      AND (is_system_generated = true OR system_type = 'walking_customer' OR is_default = true)
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;

    IF v_primary_id IS NULL THEN
      CONTINUE;
    END IF;

    -- All other walk-ins for this company = duplicates
    SELECT ARRAY_AGG(id ORDER BY created_at)
    INTO v_duplicate_ids
    FROM public.contacts
    WHERE company_id = r_company.company_id
      AND type IN ('customer', 'both')
      AND (is_system_generated = true OR system_type = 'walking_customer' OR is_default = true)
      AND id != v_primary_id;

    IF v_duplicate_ids IS NULL OR array_length(v_duplicate_ids, 1) IS NULL THEN
      CONTINUE;
    END IF;

    -- Reassign: point all references from each duplicate to primary
    FOREACH v_dup_id IN ARRAY v_duplicate_ids
    LOOP
      UPDATE public.sales SET customer_id = v_primary_id WHERE customer_id = v_dup_id;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sale_returns' AND column_name = 'customer_id') THEN
        UPDATE public.sale_returns SET customer_id = v_primary_id WHERE customer_id = v_dup_id;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rentals') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rentals' AND column_name = 'customer_id') THEN
          UPDATE public.rentals SET customer_id = v_primary_id WHERE customer_id = v_dup_id;
        END IF;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_orders') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_orders' AND column_name = 'customer_id') THEN
          UPDATE public.studio_orders SET customer_id = v_primary_id WHERE customer_id = v_dup_id;
        END IF;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_notes') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_notes' AND column_name = 'customer_id') THEN
          UPDATE public.credit_notes SET customer_id = v_primary_id WHERE customer_id = v_dup_id;
        END IF;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'contact_id') THEN
        UPDATE public.payments SET contact_id = v_primary_id WHERE contact_id = v_dup_id;
      END IF;
      -- ledger_master: customer ledgers keyed by entity_id (if type customer exists)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ledger_master') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ledger_master' AND column_name = 'entity_id') THEN
          UPDATE public.ledger_master SET entity_id = v_primary_id WHERE entity_id = v_dup_id AND ledger_type = 'customer';
        END IF;
      END IF;
    END LOOP;

    -- Delete duplicate walk-in contacts (after reassignment)
    DELETE FROM public.contacts
    WHERE company_id = r_company.company_id
      AND type IN ('customer', 'both')
      AND (is_system_generated = true OR system_type = 'walking_customer' OR is_default = true)
      AND id != v_primary_id;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- PHASE 3: Companies with exactly one walk-in – ensure is_default + code
-- ----------------------------------------------------------------------------
UPDATE public.contacts
SET is_default = true,
    is_system_generated = true,
    system_type = 'walking_customer',
    name = 'Walk-in Customer',
    code = 'CUS-0000'
WHERE type IN ('customer', 'both')
  AND (is_system_generated = true OR system_type = 'walking_customer' OR is_default = true)
  AND (code IS NULL OR code != 'CUS-0000');

-- ----------------------------------------------------------------------------
-- PHASE 4: Enforce single walk-in per company (partial unique index)
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.unique_walkin_per_company;
CREATE UNIQUE INDEX unique_walkin_per_company
  ON public.contacts (company_id)
  WHERE (is_system_generated = true AND type IN ('customer', 'both'));

-- Keep existing partial unique on is_default (one default per company)
DROP INDEX IF EXISTS public.idx_contacts_one_default_per_company;
CREATE UNIQUE INDEX idx_contacts_one_default_per_company
  ON public.contacts (company_id)
  WHERE is_default = true AND type IN ('customer', 'both');

-- ----------------------------------------------------------------------------
-- PHASE 5: Backfill sales with null customer_id → walk-in
-- ----------------------------------------------------------------------------
UPDATE public.sales s
SET customer_id = (
  SELECT ct.id FROM public.contacts ct
  WHERE ct.company_id = s.company_id
    AND (ct.is_default = true OR (ct.is_system_generated = true AND ct.system_type = 'walking_customer'))
    AND ct.type IN ('customer', 'both')
  LIMIT 1
)
WHERE s.customer_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.contacts ct
    WHERE ct.company_id = s.company_id
      AND (ct.is_default = true OR (ct.is_system_generated = true AND ct.system_type = 'walking_customer'))
  );

-- ----------------------------------------------------------------------------
-- PHASE 6: Verify (run manually after migration; comment for reference)
-- ----------------------------------------------------------------------------
-- SELECT company_id, COUNT(*) AS walkin_count
-- FROM public.contacts
-- WHERE (is_system_generated = true OR system_type = 'walking_customer') AND type IN ('customer', 'both')
-- GROUP BY company_id;
-- Expected: 1 row per company, walkin_count = 1

COMMENT ON INDEX unique_walkin_per_company IS 'Exactly one system walk-in customer per company. Ledger and sales must use this single ID.';
