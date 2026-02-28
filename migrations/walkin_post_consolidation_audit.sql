-- ============================================================================
-- WALK-IN POST-CONSOLIDATION DEEP AUDIT
-- Run after walkin_consolidation_single_per_company.sql
-- Verifies: 1 walk-in per company, all sales use that ID, no orphan references.
-- ============================================================================
-- Run each section in order. Fix any failures with STEP 6 templates, then re-run.
-- ============================================================================

-- --------------------------------------------------
-- STEP 1 — VERIFY WALK-IN COUNT (expect 1 per company)
-- --------------------------------------------------
SELECT 'STEP 1: Walk-in count per company (expect 1 per row)' AS step;
SELECT company_id, COUNT(*) AS walkin_count
FROM public.contacts
WHERE is_system_generated = true
  AND system_type = 'walking_customer'
GROUP BY company_id;
-- Expected: Each company_id appears once with walkin_count = 1.
-- If any row has walkin_count > 1 → re-run consolidation or fix manually.

-- --------------------------------------------------
-- STEP 2 — GET PRIMARY WALK-IN ID PER COMPANY
-- --------------------------------------------------
SELECT 'STEP 2: Primary walk-in id per company' AS step;
SELECT id AS primary_walkin_id, company_id, code, name
FROM public.contacts
WHERE is_system_generated = true
  AND system_type = 'walking_customer';
-- Store these IDs for STEP 6 if you need hard reassign.

-- --------------------------------------------------
-- STEP 3 — SALES NOT LINKED TO PRIMARY (orphan / wrong walk-in)
-- Sales that have a customer_id which is a walk-in but NOT the primary for that company.
-- After consolidation this should return 0 rows.
-- --------------------------------------------------
SELECT 'STEP 3: Sales whose customer_id is walk-in but not primary for that company' AS step;
SELECT s.id AS sale_id, s.company_id, s.customer_id, s.invoice_no,
       (SELECT id FROM public.contacts c2
        WHERE c2.company_id = s.company_id
          AND c2.is_system_generated = true AND c2.system_type = 'walking_customer'
        LIMIT 1) AS primary_walkin_id
FROM public.sales s
JOIN public.contacts c ON c.id = s.customer_id
WHERE c.is_system_generated = true AND c.system_type = 'walking_customer'
  AND EXISTS (
    SELECT 1 FROM public.contacts c2
    WHERE c2.company_id = s.company_id
      AND c2.is_system_generated = true AND c2.system_type = 'walking_customer'
      AND c2.id != s.customer_id
  );
-- Expected: 0 rows. If any rows → run STEP 6 (reassign sales to primary_walkin_id).

-- --------------------------------------------------
-- STEP 3b — SALES WITH CUSTOMER_ID NOT IN CONTACTS (hard orphan)
-- --------------------------------------------------
SELECT 'STEP 3b: Sales with customer_id not in contacts (FK would usually prevent)' AS step;
SELECT s.id, s.company_id, s.customer_id, s.invoice_no
FROM public.sales s
LEFT JOIN public.contacts c ON c.id = s.customer_id
WHERE s.customer_id IS NOT NULL AND c.id IS NULL;
-- Expected: 0 rows.

-- --------------------------------------------------
-- STEP 4 — LEDGER_MASTER (if table exists and has customer type)
-- This codebase uses entity_id + ledger_type; customer ledger is often from sales RPC.
-- --------------------------------------------------
SELECT 'STEP 4: ledger_master by entity (customer type if present)' AS step;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ledger_master') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ledger_master' AND column_name = 'entity_id') THEN
      RAISE NOTICE 'ledger_master.entity_id (ledger_type = customer if exists):';
    END IF;
  ELSE
    RAISE NOTICE 'ledger_master table not present; customer ledger is from sales (get_customer_ledger_sales).';
  END IF;
END $$;
-- If ledger_master exists and has ledger_type = 'customer':
-- SELECT entity_id, ledger_type, COUNT(*) FROM public.ledger_master WHERE ledger_type = 'customer' GROUP BY entity_id, ledger_type;
-- Verify entity_id values are in STEP 2 primary_walkin_id list.

-- --------------------------------------------------
-- STEP 5 — JOURNAL_ENTRIES (contact_id only if column exists)
-- --------------------------------------------------
SELECT 'STEP 5: journal_entries.contact_id distinct (if column exists)' AS step;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'contact_id') THEN
    RAISE NOTICE 'Run: SELECT DISTINCT contact_id FROM public.journal_entries WHERE contact_id IS NOT NULL;';
    RAISE NOTICE 'Verify only primary walk-in IDs appear (compare with STEP 2).';
  ELSE
    RAISE NOTICE 'journal_entries has no contact_id; customer linkage is via sales/payments.';
  END IF;
END $$;
-- Manual run if column exists:
-- SELECT DISTINCT contact_id FROM public.journal_entries WHERE contact_id IS NOT NULL;

-- --------------------------------------------------
-- STEP 6 — HARD REASSIGN (run manually if STEP 3 found issues)
-- Replace <primary_walkin_id> and <old_id> with actual UUIDs from STEP 2 / STEP 3.
-- --------------------------------------------------
-- UPDATE public.sales           SET customer_id = '<primary_walkin_id>' WHERE customer_id = '<old_id>';
-- UPDATE public.payments        SET contact_id  = '<primary_walkin_id>' WHERE contact_id  = '<old_id>';
-- UPDATE public.sale_returns    SET customer_id = '<primary_walkin_id>' WHERE customer_id = '<old_id>';
-- UPDATE public.rentals         SET customer_id = '<primary_walkin_id>' WHERE customer_id = '<old_id>';
-- UPDATE public.credit_notes    SET customer_id = '<primary_walkin_id>' WHERE customer_id = '<old_id>';
-- UPDATE public.studio_orders   SET customer_id = '<primary_walkin_id>' WHERE customer_id = '<old_id>';
-- If ledger_master has customer type:
-- UPDATE public.ledger_master  SET entity_id   = '<primary_walkin_id>' WHERE entity_id   = '<old_id>' AND ledger_type = 'customer';
-- If journal_entries has contact_id:
-- UPDATE public.journal_entries SET contact_id  = '<primary_walkin_id>' WHERE contact_id  = '<old_id>';
-- Then re-run STEP 1–3 and STEP 8.

-- --------------------------------------------------
-- STEP 7 — FORCE LEDGER REFRESH (application / cache)
-- --------------------------------------------------
-- Recalculate ledger totals if your app caches them.
-- Clear any materialized views if used for customer ledger.

-- --------------------------------------------------
-- STEP 8 — FINAL VERIFY: sales count vs ledger
-- For each primary walk-in, sales count should match what ledger shows.
-- --------------------------------------------------
SELECT 'STEP 8: Sales count per primary walk-in (compare with ledger in app)' AS step;
SELECT c.id AS primary_walkin_id, c.company_id, c.code,
       (SELECT COUNT(*) FROM public.sales s WHERE s.customer_id = c.id) AS sales_count
FROM public.contacts c
WHERE c.is_system_generated = true
  AND c.system_type = 'walking_customer';
-- Compare sales_count with ledger total for that customer in the app; they must match.
