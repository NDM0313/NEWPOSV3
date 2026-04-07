-- =============================================================================
-- COMPANY-SCOPED SUPPLIER OPENING — VERIFY + OPTIONAL SQL (REVIEW / MANUAL RUN)
-- Company: 595c08c2-1e47-4581-89c9-1f78de51c613
-- =============================================================================
-- Primary repair path: run in app (logged-in user for this company):
--   import { openingBalanceJournalService } from '@/app/services/openingBalanceJournalService';
--   await openingBalanceJournalService.repairCompanySupplierOpeningBalances(
--     '595c08c2-1e47-4581-89c9-1f78de51c613'
--   );
-- That normalizes supplier-only rows (opening_balance → supplier_opening_balance) and
-- re-runs syncFromContactRow for supplier/both contacts (posts opening_balance_contact_ap).
--
-- This file is additive verification SQL only. No destructive DDL.
-- =============================================================================

-- STEP 0 — Schema sanity (columns used by app + RPCs; adjust if your DB differs)
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name IN ('contacts', 'journal_entries', 'journal_entry_lines', 'accounts')
-- ORDER BY table_name, ordinal_position;

-- -----------------------------------------------------------------------------
-- STEP 1 — Supplier contacts that looked “wrong” before repair (supplier-only pattern)
-- -----------------------------------------------------------------------------
SELECT
  id,
  name,
  type,
  opening_balance,
  supplier_opening_balance
FROM public.contacts
WHERE company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
  AND type = 'supplier'
  AND COALESCE(supplier_opening_balance, 0) = 0
  AND COALESCE(opening_balance, 0) > 0;

-- -----------------------------------------------------------------------------
-- AP opening journals for this company (party link = journal_entries.reference_id)
-- -----------------------------------------------------------------------------
SELECT
  je.id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.is_void
FROM public.journal_entries je
WHERE je.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'opening_balance_contact_ap'
  AND COALESCE(je.is_void, FALSE) = FALSE
ORDER BY je.entry_date, je.created_at;

-- Lines on 2000 AP (resolve account id first)
WITH ap AS (
  SELECT a.id AS ap_id
  FROM public.accounts a
  WHERE a.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
    AND TRIM(COALESCE(a.code, '')) = '2000'
    AND COALESCE(a.is_active, TRUE)
  LIMIT 1
)
SELECT
  je.id AS journal_entry_id,
  je.reference_id AS supplier_contact_id,
  jel.debit,
  jel.credit
FROM public.journal_entry_lines jel
INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
CROSS JOIN ap
WHERE je.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
  AND jel.account_id = ap.ap_id
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'opening_balance_contact_ap'
  AND COALESCE(je.is_void, FALSE) = FALSE;

-- -----------------------------------------------------------------------------
-- Trial Balance–style check: net on 2000 = SUM(debit - credit) on lines for company
-- (matches app convention debit − credit on lines)
-- -----------------------------------------------------------------------------
WITH ap AS (
  SELECT a.id AS ap_id
  FROM public.accounts a
  WHERE a.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
    AND TRIM(COALESCE(a.code, '')) = '2000'
    AND COALESCE(a.is_active, TRUE)
  LIMIT 1
),
lines AS (
  SELECT jel.debit, jel.credit
  FROM public.journal_entry_lines jel
  INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
  CROSS JOIN ap
  WHERE je.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
    AND jel.account_id = ap.ap_id
    AND COALESCE(je.is_void, FALSE) = FALSE
)
SELECT
  ROUND(COALESCE(SUM(debit), 0)::numeric, 4) AS total_debit_2000,
  ROUND(COALESCE(SUM(credit), 0)::numeric, 4) AS total_credit_2000,
  ROUND(COALESCE(SUM(debit - credit), 0)::numeric, 4) AS net_dr_minus_cr_2000
FROM lines;

-- -----------------------------------------------------------------------------
-- OPTIONAL manual data fix (supplier-only) — only if you cannot run the app repair.
-- Moves legacy payable from opening_balance into supplier_opening_balance.
-- Run once; then still run app repairCompanySupplierOpeningBalances OR at least
-- openingBalanceJournalService.syncFromContactRow per contact id.
-- -----------------------------------------------------------------------------
-- UPDATE public.contacts c
-- SET
--   supplier_opening_balance = COALESCE(c.opening_balance, 0),
--   opening_balance = 0
-- WHERE c.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'::uuid
--   AND c.type = 'supplier'
--   AND COALESCE(c.supplier_opening_balance, 0) = 0
--   AND COALESCE(c.opening_balance, 0) > 0;
