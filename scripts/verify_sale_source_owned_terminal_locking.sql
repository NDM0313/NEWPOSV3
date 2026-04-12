-- =====================================================================
-- VERIFICATION: Sale Source-Owned JEs & Terminal State Locking
-- Purpose  : Read-only audit of source-owned journal integrity and
--            terminal cancel (void) completeness for sale returns
-- Safe     : All SELECT only. No modifications.
-- Run on   : Supabase / Postgres (direct or via SQL console)
-- Date     : 2026-04-12
-- Context  : FINAL_SALE_RETURN_ENGINE_HISTORIC_AUDIT_AND_REPAIR_CLOSURE
-- =====================================================================


-- ─── CHECK I ─────────────────────────────────────────────────────────────────
-- Source-owned JE counts by reference_type.
-- All sale/sale_return/sale_reversal JEs are source-owned — blocked from direct
-- edit or manual reversal via resolveUnifiedJournalEdit() in unifiedTransactionEdit.ts.
-- This check is informational: shows total volume and date range per type.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  je.reference_type,
  COUNT(DISTINCT je.id)          AS journal_entry_count,
  COUNT(jel.id)                  AS line_count,
  SUM(jel.debit)                 AS total_debit,
  SUM(jel.credit)                AS total_credit,
  ABS(SUM(jel.debit) - SUM(jel.credit)) AS imbalance,  -- should be 0
  MIN(je.entry_date)             AS earliest,
  MAX(je.entry_date)             AS latest
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.reference_type IN ('sale','sale_return','sale_reversal','sale_adjustment','sale_cancellation')
  AND (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY je.reference_type
ORDER BY je.reference_type;

-- Expected: imbalance = 0 for all rows (every JE is balanced).
-- reference_type coverage depends on how many sales/returns exist.


-- ─── CHECK II ────────────────────────────────────────────────────────────────
-- Terminal state consistency: voided returns should have no active (non-void) JEs.
-- When voidSaleReturn runs, it calls createReversalEntry for every JE with
-- reference_type='sale_return' and reference_id=returnId.
-- Any voided return with non-void JEs indicates voidSaleReturn was partially applied.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.id              AS return_id,
  sr.return_no,
  sr.company_id,
  sr.status,
  sr.created_at,
  COUNT(je.id)       AS active_je_count,
  STRING_AGG(je.entry_no, ', ' ORDER BY je.entry_no) AS active_je_entries
FROM sale_returns sr
JOIN journal_entries je
  ON je.reference_id = sr.id
  AND je.reference_type = 'sale_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE sr.status = 'void'     -- voided return with active JEs = incomplete void
GROUP BY sr.id, sr.return_no, sr.company_id, sr.status, sr.created_at
ORDER BY sr.created_at DESC
LIMIT 50;

-- Expected: 0 rows. Any rows indicate voidSaleReturn ran but JE reversal failed.
-- Fix: Re-run voidSaleReturn from the application for each identified return.


-- ─── CHECK III ───────────────────────────────────────────────────────────────
-- Void stock movement completeness.
-- When a sale return is voided, stock_movements for that return should be reversed
-- (matching negative-quantity entry with movement_type='sale_return_void' or similar).
-- This checks for voided returns where the stock-back movement is missing.
-- ─────────────────────────────────────────────────────────────────────────────
WITH voided_return_stock AS (
  SELECT
    sm.reference_id    AS return_id,
    SUM(sm.quantity)   AS net_quantity,
    SUM(sm.total_cost) AS net_cost,
    COUNT(*)           AS movement_count
  FROM stock_movements sm
  WHERE sm.reference_type = 'sale_return'
  GROUP BY sm.reference_id
)
SELECT
  sr.id              AS return_id,
  sr.return_no,
  sr.company_id,
  sr.status,
  vrs.net_quantity   AS net_stock_qty,
  vrs.net_cost       AS net_stock_cost,
  vrs.movement_count,
  CASE
    WHEN vrs.net_quantity > 0 THEN 'STOCK NOT REVERSED (positive qty on voided return)'
    WHEN vrs.net_quantity < 0 THEN 'OVER-REVERSED (net negative stock)'
    WHEN vrs.net_quantity = 0 THEN 'OK (balanced)'
  END AS diagnosis
FROM sale_returns sr
JOIN voided_return_stock vrs ON vrs.return_id = sr.id
WHERE sr.status = 'void'
  AND vrs.net_quantity != 0
ORDER BY sr.created_at DESC
LIMIT 50;

-- Expected: 0 rows (or only 'OK' rows if included). Positive net qty on void = stock leaked.
-- Fix: Re-run voidSaleReturn from the application, or manually insert the reversal stock movement.


-- ─── CHECK IV ────────────────────────────────────────────────────────────────
-- Stale draft sale_returns (draft status older than 7 days).
-- These are abandoned return attempts that never reached final state.
-- They do not have JEs but may have reserved stock or confused the return workflow.
-- Informational: report them for manual review/cleanup.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.id              AS return_id,
  sr.return_no,
  sr.company_id,
  sr.status,
  sr.total,
  sr.created_at,
  CURRENT_DATE - sr.created_at::date AS days_old,
  CASE WHEN sr.original_sale_id IS NULL THEN 'standalone' ELSE 'linked to ' || sr.original_sale_id END AS return_type
FROM sale_returns sr
WHERE sr.status = 'draft'
  AND sr.created_at < NOW() - INTERVAL '7 days'
ORDER BY sr.created_at ASC
LIMIT 100;

-- Expected: 0 rows (or rows for known abandoned returns).
-- Action: Manually void or delete stale drafts to unblock the original sale for re-return.
-- Note: Deleting draft sale_returns is safe only if no stock_movements reference them.
--       Always check: SELECT * FROM stock_movements WHERE reference_id = '<draft_return_id>';


-- ─── CHECK V ─────────────────────────────────────────────────────────────────
-- Orphan JE detection: JEs with reference_type='sale' or 'sale_return' where the
-- referenced document no longer exists (or has wrong status).
-- This catches JEs manually inserted without a corresponding application record.
-- ─────────────────────────────────────────────────────────────────────────────
-- Orphan sale JEs (reference_id not in sales table)
SELECT
  'sale' AS document_type,
  je.id              AS journal_entry_id,
  je.reference_id    AS claimed_sale_id,
  je.entry_no,
  je.entry_date,
  je.company_id,
  'NO matching sale record' AS issue
FROM journal_entries je
WHERE je.reference_type = 'sale'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND NOT EXISTS (
    SELECT 1 FROM sales s WHERE s.id = je.reference_id
  )
ORDER BY je.entry_date DESC
LIMIT 50;

-- Orphan sale_return JEs (reference_id not in sale_returns table)
SELECT
  'sale_return' AS document_type,
  je.id              AS journal_entry_id,
  je.reference_id    AS claimed_return_id,
  je.entry_no,
  je.entry_date,
  je.company_id,
  'NO matching sale_return record' AS issue
FROM journal_entries je
WHERE je.reference_type = 'sale_return'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
  AND NOT EXISTS (
    SELECT 1 FROM sale_returns sr WHERE sr.id = je.reference_id
  )
ORDER BY je.entry_date DESC
LIMIT 50;

-- Expected: 0 rows from both queries.
-- Any rows are orphan JEs: void them (they represent accounting without a source document).


-- ─── CHECK VI (BONUS) ────────────────────────────────────────────────────────
-- Double-entry balance check: verify all active sale/sale_return JEs are balanced.
-- Every JE must have total_debit = total_credit.
-- Unbalanced JEs indicate a partial insert or data corruption.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  je.id              AS journal_entry_id,
  je.reference_type,
  je.reference_id,
  je.entry_no,
  je.entry_date,
  je.company_id,
  SUM(jel.debit)     AS total_debit,
  SUM(jel.credit)    AS total_credit,
  ABS(SUM(jel.debit) - SUM(jel.credit)) AS imbalance
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.reference_type IN ('sale','sale_return','sale_reversal','sale_adjustment')
  AND (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY je.id, je.reference_type, je.reference_id, je.entry_no, je.entry_date, je.company_id
HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) > 0.01
ORDER BY je.entry_date DESC
LIMIT 50;

-- Expected: 0 rows. Any rows represent corrupted / partial JEs — investigate and void.


-- ─── SUMMARY ─────────────────────────────────────────────────────────────────
-- CHECK I   → Source-owned JE volume by reference_type (informational / balance check)
-- CHECK II  → Voided returns with active JEs (incomplete voidSaleReturn)
-- CHECK III → Voided returns with unreversed stock movements (stock leaked)
-- CHECK IV  → Stale draft returns > 7 days old (cleanup candidates)
-- CHECK V   → Orphan JEs with no matching source document
-- CHECK VI  → Unbalanced JEs in sale/sale_return (data integrity)
-- ─────────────────────────────────────────────────────────────────────────────
