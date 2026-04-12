-- =====================================================================
-- REPAIR: Sale Return Discount Bug — Company 595c08c2
-- Purpose  : Fix sale_return.discount_amount = 0 for returns against
--            discounted sales; void inflated settlement JEs; repost
--            with correct net amount.
-- Company  : 595c08c2-1e47-4581-89c9-1f78de51c613
-- Date     : 2026-04-12
-- Context  : FINAL_COMPANY_595C08C2_SALE_ENGINE_FULL_AUDIT_AND_REPAIR
-- Run on   : Supabase / Postgres via:
--            docker exec supabase-db psql -U postgres -d postgres
-- =====================================================================
-- LAST RUN RESULT (2026-04-12):
--   BLOCK A: Updated 2 returns (Mohsin discount→200 total→31,000;
--             Nabeel discount→1333.33 total→123,466.67)
--   BLOCK B: Voided 2 settlement JEs (JE-0120 Mohsin 31200; JE-0108 Nabeel 124800)
--   BLOCK C: Reposted JE-0121 (Mohsin 31000 Dr Revenue / Cr AR-Mohsin)
--            Reposted JE-0122 (Nabeel 123466.67 Dr Revenue / Cr Cash)
--   POST-CHECK: 0 remaining MISSING DISCOUNT; all 4 final JEs = MATCH
-- =====================================================================

-- ─── PRE-REPAIR SNAPSHOT ─────────────────────────────────────────────────────
-- Run this first to record before-state.
SELECT
  sr.return_no, sr.status,
  s.invoice_no, s.customer_name,
  s.discount_amount AS sale_discount,
  sr.subtotal AS return_subtotal, sr.discount_amount AS return_discount, sr.total AS return_total,
  (SELECT COALESCE(SUM(jel.debit),0) FROM journal_entries je
   JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
   JOIN accounts a ON a.id=jel.account_id AND a.code IN ('4000','4100','4010')
   WHERE je.reference_id=sr.id AND je.reference_type='sale_return'
     AND (je.is_void IS NULL OR je.is_void=FALSE)) AS current_settlement_je
FROM sale_returns sr
JOIN sales s ON s.id=sr.original_sale_id
WHERE sr.company_id='595c08c2-1e47-4581-89c9-1f78de51c613'
  AND s.discount_amount>0
  AND sr.discount_amount=0
  AND sr.status='final'
ORDER BY sr.created_at;

-- ─── BLOCK A: Fix return header discount_amount ────────────────────────────────
-- For each final return with discount_amount=0 but original sale has discount,
-- compute proportional discount and update the return header.
-- Formula: return_discount = sale.discount_amount × (return.subtotal / sale.subtotal)
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

UPDATE sale_returns sr
SET
  discount_amount = ROUND((s.discount_amount / NULLIF(s.subtotal, 0) * sr.subtotal)::NUMERIC, 2),
  total           = ROUND((sr.subtotal - s.discount_amount / NULLIF(s.subtotal, 0) * sr.subtotal)::NUMERIC, 2),
  updated_at      = NOW()
FROM sales s
WHERE sr.original_sale_id = s.id
  AND sr.company_id       = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.status           = 'final'
  AND s.discount_amount   > 0
  AND sr.discount_amount  = 0
  AND s.subtotal          > 0;

-- Verify: should show updated rows with correct discount
SELECT return_no, subtotal, discount_amount, total FROM sale_returns
WHERE company_id='595c08c2-1e47-4581-89c9-1f78de51c613'
  AND status='final'
  AND discount_amount > 0
ORDER BY created_at;

COMMIT;

-- ─── BLOCK B: Void inflated settlement JEs ─────────────────────────────────────
-- For each return where Block A applied, void the settlement JE that used
-- the wrong (gross) amount.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

UPDATE journal_entries je
SET
  is_void    = TRUE,
  updated_at = NOW()
WHERE je.company_id     = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND je.reference_type = 'sale_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND je.id IN (
    SELECT DISTINCT je2.id
    FROM journal_entries je2
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je2.id
    JOIN accounts a ON a.id = jel.account_id AND a.code IN ('4000','4100','4010') AND jel.debit > 0
    JOIN sale_returns sr ON sr.id = je2.reference_id
    JOIN sales s ON s.id = sr.original_sale_id
    WHERE sr.company_id      = '595c08c2-1e47-4581-89c9-1f78de51c613'
      AND sr.status          = 'final'
      AND s.discount_amount  > 0
      -- The JE debit amount MISMATCHES the updated return.total (net)
      AND ABS(jel.debit - sr.total) > 0.01
  );

-- Verify: count voided JEs
SELECT COUNT(*) AS voided_settlement_jes
FROM journal_entries je
WHERE je.company_id='595c08c2-1e47-4581-89c9-1f78de51c613'
  AND je.reference_type='sale_return'
  AND je.is_void=TRUE
  AND je.updated_at::date = NOW()::date;

COMMIT;

-- ─── BLOCK C: Repost settlement JEs with correct net amounts ────────────────────
-- For each affected return, insert a new settlement JE.
-- Canonical format:
--   Dr Sales Revenue (4100 in company 595c08c2): return.total (net)
--   Cr Cash / Bank / AR (depends on refund_method): return.total (net)
--
-- Company 595c08c2 account IDs:
--   Sales Revenue (4100): 0699c77b-2f97-4ebd-9a3a-072544cacc9b
--   Cash (1000):          95b1e088-5bb4-436a-b440-3070f4494f33
--   Bank (1010):          a4838f20-5eec-4fa4-9af5-131808b9d78d
--   AR (1100):            760dd283-4b20-4d19-baf3-5b7dd7ee292a
--   Branch:               60c8f42a-9634-4071-810d-3a0840dfbf5b
--
-- NOTE: For the credit side, use the SAME account that the ORIGINAL (voided) JE used.
-- Query the voided JE's credit lines to determine the account.
-- ─────────────────────────────────────────────────────────────────────────────

-- First: identify which credit accounts were used in each voided JE
SELECT
  sr.return_no,
  sr.id           AS return_id,
  sr.total        AS correct_net_total,
  sr.discount_amount AS discount,
  a_dr.code       AS revenue_debit_acct,
  a_cr.code       AS credit_acct,
  a_cr.id         AS credit_acct_id,
  a_cr.name       AS credit_acct_name,
  je.id           AS voided_je_id
FROM sale_returns sr
JOIN journal_entries je
  ON  je.reference_id   = sr.id
  AND je.reference_type = 'sale_return'
  AND je.is_void        = TRUE
JOIN journal_entry_lines jel_cr ON jel_cr.journal_entry_id = je.id AND jel_cr.credit > 0
JOIN accounts a_cr ON a_cr.id = jel_cr.account_id
JOIN journal_entry_lines jel_dr ON jel_dr.journal_entry_id = je.id AND jel_dr.debit > 0
JOIN accounts a_dr ON a_dr.id = jel_dr.account_id
JOIN sales s ON s.id = sr.original_sale_id
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.status     = 'final'
  AND s.discount_amount > 0
  AND je.updated_at::date = NOW()::date  -- only JEs voided in Block B today
ORDER BY sr.created_at;

-- After identifying credit accounts above, insert corrected JEs:
-- (Template — fill in UUIDs from query above; run one block per return)

-- TEMPLATE — DO NOT EXECUTE AS-IS:
/*
BEGIN;
-- Insert corrected settlement JE for return <return_no>
WITH new_je AS (
  INSERT INTO journal_entries (
    company_id, branch_id, entry_date, description,
    reference_id, reference_type, source,
    action_fingerprint, is_void, created_by
  ) VALUES (
    '595c08c2-1e47-4581-89c9-1f78de51c613',
    '60c8f42a-9634-4071-810d-3a0840dfbf5b',
    '<return_date>',
    'Sale Return Settlement (corrected net): <return_no>',
    '<return_id>',
    'sale_return',
    'Sale_Return',
    'sale_return_settlement:595c08c2-1e47-4581-89c9-1f78de51c613:<return_id>',
    FALSE,
    NULL
  )
  RETURNING id
)
INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit)
VALUES
  ((SELECT id FROM new_je), '0699c77b-2f97-4ebd-9a3a-072544cacc9b', 'Sale Return — Revenue reversal', <net_total>, 0),
  ((SELECT id FROM new_je), '<credit_account_id>',                   'Sale Return — Refund',           0, <net_total>);
COMMIT;
*/

-- ─── POST-REPAIR VERIFICATION ─────────────────────────────────────────────────
-- After executing Blocks A–C, run these to confirm clean state.

-- Verify 1: No more returns with missing discount on discounted-sale returns
SELECT COUNT(*) AS should_be_zero
FROM sale_returns sr
JOIN sales s ON s.id = sr.original_sale_id
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.status     = 'final'
  AND s.discount_amount > 0
  AND sr.discount_amount = 0;

-- Verify 2: Settlement JE amounts match return.total
SELECT
  sr.return_no,
  sr.total AS return_net,
  SUM(jel.debit) AS settlement_debit,
  ABS(SUM(jel.debit) - sr.total) AS discrepancy
FROM sale_returns sr
JOIN journal_entries je ON je.reference_id=sr.id AND je.reference_type='sale_return'
JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
JOIN accounts a ON a.id=jel.account_id AND a.code IN ('4000','4100','4010')
WHERE sr.company_id='595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.status='final'
  AND (je.is_void IS NULL OR je.is_void=FALSE)
GROUP BY sr.return_no, sr.total
ORDER BY discrepancy DESC;

-- Expected: all discrepancy < 0.01.
