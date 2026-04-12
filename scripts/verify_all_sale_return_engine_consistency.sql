-- =====================================================================
-- VERIFICATION: All Sale Return Engine Consistency
-- Purpose  : Comprehensive read-only audit of all sale return accounting paths
-- Safe     : All SELECT only. No modifications.
-- Run on   : Supabase / Postgres via: docker exec supabase-db psql -U postgres -d postgres
-- Date     : 2026-04-12
-- Context  : FINAL_SALE_RETURN_ENGINE_HISTORIC_AUDIT_AND_REPAIR_CLOSURE
-- Prereqs  : FINAL_SALE_ENGINE_AND_MANUAL_SALE_RETURN_STANDARDIZATION_CLOSURE
-- =====================================================================
-- LAST RUN RESULT (2026-04-12 post-repair):
--   All final returns: settlement_je=1, inventory_je=1, MATCH
--   All void returns:  settlement_je=0, inventory_je=0, VOID-OK
--   No duplicate JEs, no unbalanced JEs, no wrong routing.
-- =====================================================================

-- Reference — canonical account codes used in this system:
-- 1000/1010/1020 = Cash / Bank / Mobile Wallet
-- 1100 = Accounts Receivable (AR)
-- 1200 = Inventory (asset)
-- 2000 = Accounts Payable (AP) — WRONG for sale return settlement
-- 4000/4100 = Sales Revenue (code varies per company)
-- 5000 = COGS / Cost of Production (code varies per company name, but code always 5000)


-- ─── CHECK A ─────────────────────────────────────────────────────────────────
-- Settlement JE count per finalized return (should be exactly 1).
-- Expected: 0 rows returned (all returns have exactly 1 settlement JE).
-- ─────────────────────────────────────────────────────────────────────────────
WITH settlement_counts AS (
  SELECT
    sr.id                          AS return_id,
    sr.return_no,
    sr.company_id,
    sr.status,
    sr.created_at,
    CASE WHEN sr.original_sale_id IS NULL THEN 'standalone' ELSE 'linked' END AS return_type,
    COUNT(DISTINCT je.id)          AS settlement_je_count
  FROM sale_returns sr
  LEFT JOIN journal_entries je ON je.reference_id = sr.id
    AND je.reference_type = 'sale_return'
    AND (je.is_void IS NULL OR je.is_void = FALSE)
  LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  LEFT JOIN accounts a ON a.id = jel.account_id
    AND a.code IN ('4000', '4100', '4010')
    AND jel.debit > 0
  WHERE sr.status = 'final'
    AND a.id IS NOT NULL
  GROUP BY sr.id, sr.return_no, sr.company_id, sr.status, sr.created_at, sr.original_sale_id
)
SELECT return_id, return_no, company_id, return_type, settlement_je_count,
  CASE
    WHEN settlement_je_count = 0 THEN 'MISSING settlement JE'
    WHEN settlement_je_count = 1 THEN 'OK'
    WHEN settlement_je_count > 1 THEN 'DUPLICATE settlement JEs — needs repair'
  END AS diagnosis,
  created_at
FROM settlement_counts
WHERE settlement_je_count != 1
ORDER BY CASE WHEN settlement_je_count > 1 THEN 0 WHEN settlement_je_count = 0 THEN 1 ELSE 2 END, created_at DESC
LIMIT 200;

-- Expected: 0 rows.


-- ─── CHECK B ─────────────────────────────────────────────────────────────────
-- Inventory reversal JE count per finalized return (should be exactly 1 if cost > 0).
-- Expected: 0 rows returned (all returns with cost have exactly 1 inventory JE).
-- ─────────────────────────────────────────────────────────────────────────────
WITH stock_costs AS (
  SELECT reference_id AS return_id, SUM(total_cost) AS total_cost
  FROM stock_movements
  WHERE reference_type = 'sale_return' AND movement_type = 'sale_return' AND quantity > 0
  GROUP BY reference_id
),
inv_je_counts AS (
  SELECT je.reference_id AS return_id, COUNT(DISTINCT je.id) AS inv_je_count
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id AND a.code = '1200' AND jel.debit > 0
  WHERE je.reference_type = 'sale_return' AND (je.is_void IS NULL OR je.is_void = FALSE)
  GROUP BY je.reference_id
)
SELECT
  sr.id AS return_id, sr.return_no, sr.company_id, sr.created_at,
  CASE WHEN sr.original_sale_id IS NULL THEN 'standalone' ELSE 'linked' END AS return_type,
  COALESCE(sc.total_cost, 0) AS stock_cost,
  COALESCE(ijc.inv_je_count, 0) AS inv_je_count,
  CASE
    WHEN COALESCE(sc.total_cost, 0) = 0  THEN 'OK (zero-cost return)'
    WHEN COALESCE(ijc.inv_je_count, 0) = 0 THEN 'MISSING inventory reversal JE (needs repair)'
    WHEN ijc.inv_je_count = 1            THEN 'OK'
    WHEN ijc.inv_je_count > 1            THEN 'DUPLICATE inventory JEs — void extras'
  END AS diagnosis
FROM sale_returns sr
LEFT JOIN stock_costs sc ON sc.return_id = sr.id
LEFT JOIN inv_je_counts ijc ON ijc.return_id = sr.id
WHERE sr.status = 'final' AND COALESCE(sc.total_cost, 0) > 0
ORDER BY CASE WHEN COALESCE(ijc.inv_je_count,0)=0 THEN 0 WHEN COALESCE(ijc.inv_je_count,0)>1 THEN 1 ELSE 2 END, sr.created_at DESC
LIMIT 200;

-- Expected: 0 rows (or only 'OK' rows).


-- ─── CHECK C ─────────────────────────────────────────────────────────────────
-- action_fingerprint coverage on settlement JEs.
-- Post-fix+repair: all settlement JEs should have fingerprint.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  CASE
    WHEN je.action_fingerprint IS NOT NULL AND je.action_fingerprint LIKE 'sale_return_settlement:%'
    THEN 'has_fingerprint'
    ELSE 'missing_fingerprint'
  END AS fingerprint_status,
  COUNT(*) AS je_count,
  MIN(je.entry_date) AS earliest,
  MAX(je.entry_date) AS latest
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id AND a.code IN ('4000','4100','4010') AND jel.debit > 0
WHERE je.reference_type = 'sale_return' AND (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY 1 ORDER BY 1;

-- Expected post-repair: only 'has_fingerprint' rows.


-- ─── CHECK D ─────────────────────────────────────────────────────────────────
-- Double-settlement detection.
-- Expected: 0 rows.
-- ─────────────────────────────────────────────────────────────────────────────
WITH settlement_je_by_return AS (
  SELECT je.reference_id AS return_id, COUNT(DISTINCT je.id) AS je_count,
    SUM(jel.debit) AS total_debit_amount
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN accounts a ON a.id = jel.account_id AND a.code IN ('4000','4100','4010') AND jel.debit > 0
  WHERE je.reference_type = 'sale_return' AND (je.is_void IS NULL OR je.is_void = FALSE)
  GROUP BY je.reference_id
)
SELECT sjbr.return_id, sr.return_no, sr.company_id, sr.total AS return_total,
  sjbr.je_count AS settlement_je_count,
  sjbr.total_debit_amount - sr.total AS overcharge_amount
FROM settlement_je_by_return sjbr
JOIN sale_returns sr ON sr.id = sjbr.return_id
WHERE sjbr.je_count > 1
ORDER BY sjbr.je_count DESC, sr.created_at DESC
LIMIT 100;

-- Expected: 0 rows.


-- ─── CHECK E ─────────────────────────────────────────────────────────────────
-- Stock movements cost vs GL inventory debit consistency.
-- Expected: 0 rows (or only VOID-OK rows).
-- ─────────────────────────────────────────────────────────────────────────────
WITH return_stock_cost AS (
  SELECT reference_id AS return_id, SUM(total_cost) AS stock_total_cost
  FROM stock_movements WHERE reference_type='sale_return' AND movement_type='sale_return' AND quantity>0
  GROUP BY reference_id
),
return_je_inv AS (
  SELECT je.reference_id AS return_id, SUM(jel.debit) AS je_inventory_debit
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
  JOIN accounts a ON a.id=jel.account_id AND a.code='1200' AND jel.debit>0
  WHERE je.reference_type='sale_return' AND (je.is_void IS NULL OR je.is_void=FALSE)
  GROUP BY je.reference_id
)
SELECT rsc.return_id, sr.return_no, sr.status, rsc.stock_total_cost,
  COALESCE(rji.je_inventory_debit,0) AS je_inventory_debit,
  ABS(rsc.stock_total_cost - COALESCE(rji.je_inventory_debit,0)) AS discrepancy,
  CASE
    WHEN sr.status='void' THEN 'VOID-OK'
    WHEN rji.je_inventory_debit IS NULL THEN 'MISSING inventory JE'
    WHEN ABS(rsc.stock_total_cost - rji.je_inventory_debit) > 0.01 THEN 'AMOUNT MISMATCH'
    ELSE 'OK'
  END AS status
FROM return_stock_cost rsc
JOIN sale_returns sr ON sr.id=rsc.return_id
LEFT JOIN return_je_inv rji ON rji.return_id=rsc.return_id
WHERE sr.status IN ('final','void')
  AND (sr.status='void' OR rji.je_inventory_debit IS NULL OR ABS(rsc.stock_total_cost - COALESCE(rji.je_inventory_debit,0)) > 0.01)
ORDER BY CASE WHEN rji.je_inventory_debit IS NULL THEN 0 WHEN sr.status='void' THEN 2 ELSE 1 END, sr.created_at DESC
LIMIT 100;

-- Expected: 0 rows with status 'MISSING' or 'AMOUNT MISMATCH'. VOID-OK rows are acceptable.


-- ─── CHECK F ─────────────────────────────────────────────────────────────────
-- Settlement routing correctness — no AP or wrong credit accounts.
-- Expected: 0 rows.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT je.id, je.reference_id, sr.return_no, je.entry_date,
  a.code AS credit_account_code, a.name AS credit_account_name, jel.credit,
  CASE
    WHEN a.code='2000' THEN 'WRONG: Credited AP (supplier)'
    WHEN a.type='expense' THEN 'WRONG: Credited expense account'
    ELSE 'CHECK: Unusual routing'
  END AS issue
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
JOIN accounts a ON a.id=jel.account_id
JOIN sale_returns sr ON sr.id=je.reference_id
WHERE je.reference_type='sale_return'
  AND (je.is_void IS NULL OR je.is_void=FALSE)
  AND jel.credit > 0
  AND a.code NOT IN ('1100','1000','1010','1020','1200','5000')
  AND a.code NOT LIKE '1%'
  AND a.code NOT LIKE 'AR-%'   -- party subledger accounts (AR-<UUID>) are valid for adjust-mode returns
ORDER BY je.entry_date DESC LIMIT 100;

-- Expected: 0 rows.


-- ─── CHECK G ─────────────────────────────────────────────────────────────────
-- Final returns with stock movements but NO journal entries at all.
-- Expected: 0 rows.
-- ─────────────────────────────────────────────────────────────────────────────
WITH returns_with_stock AS (
  SELECT DISTINCT reference_id AS return_id FROM stock_movements
  WHERE reference_type='sale_return' AND movement_type='sale_return' AND quantity>0
),
returns_with_je AS (
  SELECT DISTINCT reference_id AS return_id FROM journal_entries
  WHERE reference_type='sale_return' AND (is_void IS NULL OR is_void=FALSE)
)
SELECT sr.id, sr.return_no, sr.company_id, sr.status, sr.total, sr.created_at,
  CASE WHEN sr.original_sale_id IS NULL THEN 'standalone' ELSE 'linked' END AS return_type
FROM sale_returns sr
JOIN returns_with_stock rws ON rws.return_id=sr.id
LEFT JOIN returns_with_je rwj ON rwj.return_id=sr.id
WHERE sr.status='final' AND rwj.return_id IS NULL
ORDER BY sr.created_at DESC LIMIT 100;

-- Expected: 0 rows.


-- ─── COMBINED STATUS VIEW ─────────────────────────────────────────────────────
-- One-shot view: for each return, show settlement JE count, inventory JE count,
-- stock cost, GL inventory Dr, and reconciliation status.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.return_no,
  sr.status,
  sr.total AS return_selling_total,
  CASE WHEN sr.original_sale_id IS NULL THEN 'standalone' ELSE 'linked' END AS return_type,
  -- Settlement JE
  (SELECT COUNT(*) FROM journal_entries je
   JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
   JOIN accounts a ON a.id=jel.account_id AND a.code IN ('4000','4100','4010') AND jel.debit>0
   WHERE je.reference_id=sr.id AND je.reference_type='sale_return' AND (je.is_void IS NULL OR je.is_void=FALSE)
  ) AS settlement_je_count,
  -- Inventory JE
  (SELECT COUNT(*) FROM journal_entries je
   JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
   JOIN accounts a ON a.id=jel.account_id AND a.code='1200' AND jel.debit>0
   WHERE je.reference_id=sr.id AND je.reference_type='sale_return' AND (je.is_void IS NULL OR je.is_void=FALSE)
  ) AS inventory_je_count,
  -- Stock cost
  COALESCE((SELECT SUM(sm.total_cost) FROM stock_movements sm
    WHERE sm.reference_id=sr.id AND sm.reference_type='sale_return' AND sm.movement_type='sale_return'), 0) AS stock_cost,
  -- GL Inventory Dr
  COALESCE((SELECT SUM(jel.debit) FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    JOIN accounts a ON a.id=jel.account_id AND a.code='1200'
    WHERE je.reference_id=sr.id AND je.reference_type='sale_return' AND (je.is_void IS NULL OR je.is_void=FALSE)), 0) AS gl_inv_dr
FROM sale_returns sr
ORDER BY sr.created_at;

-- Expected post-repair:
--   final returns: settlement_je=1, inventory_je=1, stock_cost=gl_inv_dr
--   void returns:  settlement_je=0, inventory_je=0
