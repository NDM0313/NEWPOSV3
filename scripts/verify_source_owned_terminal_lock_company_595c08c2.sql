-- =====================================================================
-- VERIFICATION: Source-Owned Journal Safety & Terminal State Locks
-- Purpose  : Confirm that sale/sale_return JEs cannot be edited from the
--            Journal page, voided returns have all JEs voided, no zombie
--            rows exist, and no orphan JEs.
-- Safe     : All SELECT only. No modifications.
-- Company  : 595c08c2-1e47-4581-89c9-1f78de51c613
-- Date     : 2026-04-12
-- Context  : FINAL_COMPANY_595C08C2_SALE_ENGINE_FULL_AUDIT_AND_REPAIR
-- =====================================================================

-- ─── CHECK 1 ─────────────────────────────────────────────────────────────────
-- Source-owned JE counts by reference_type.
-- Provides a baseline of how many JEs exist for each document type.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  je.reference_type,
  COUNT(*)                            AS total_je_count,
  COUNT(*) FILTER (WHERE je.is_void IS TRUE)    AS voided_count,
  COUNT(*) FILTER (WHERE je.is_void IS NOT TRUE) AS active_count,
  COUNT(*) FILTER (WHERE je.action_fingerprint IS NOT NULL) AS has_fingerprint
FROM journal_entries je
WHERE je.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND je.reference_type IN ('sale', 'sale_return', 'sale_reversal')
GROUP BY je.reference_type
ORDER BY je.reference_type;

-- ─── CHECK 2 ─────────────────────────────────────────────────────────────────
-- Voided returns with still-active (non-void) JEs.
-- If a return is void, ALL its JEs must also be void.
-- Expected: 0 rows.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.id            AS return_id,
  sr.return_no,
  sr.status        AS return_status,
  je.id            AS je_id,
  je.entry_no,
  je.reference_type,
  je.is_void,
  je.entry_date,
  je.action_fingerprint
FROM sale_returns sr
JOIN journal_entries je ON je.reference_id = sr.id AND je.reference_type = 'sale_return'
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.status = 'void'
  AND (je.is_void IS NULL OR je.is_void = FALSE)
ORDER BY sr.created_at DESC;

-- Expected: 0 rows.

-- ─── CHECK 3 ─────────────────────────────────────────────────────────────────
-- Voided returns with stock movements not reversed.
-- For each void return, a sale_return_void stock movement must exist for each
-- sale_return movement.
-- Expected: 0 rows.
-- ─────────────────────────────────────────────────────────────────────────────
WITH voided_return_stock AS (
  SELECT sm.reference_id AS return_id, sm.product_id, sm.variation_id, sm.quantity
  FROM stock_movements sm
  JOIN sale_returns sr ON sr.id = sm.reference_id
  WHERE sm.reference_type = 'sale_return'
    AND sm.movement_type  = 'sale_return'
    AND sr.company_id     = '595c08c2-1e47-4581-89c9-1f78de51c613'
    AND sr.status         = 'void'
),
reversal_stock AS (
  SELECT sm.reference_id AS return_id, sm.product_id, sm.variation_id, ABS(sm.quantity) AS qty_reversed
  FROM stock_movements sm
  WHERE sm.reference_type = 'sale_return'
    AND sm.movement_type  = 'sale_return_void'
)
SELECT
  vrs.return_id,
  sr.return_no,
  vrs.product_id,
  vrs.quantity       AS forward_qty,
  rs.qty_reversed    AS reversed_qty,
  CASE
    WHEN rs.qty_reversed IS NULL THEN 'MISSING reversal stock movement'
    WHEN ABS(vrs.quantity - rs.qty_reversed) > 0.001 THEN 'QUANTITY MISMATCH in reversal'
    ELSE 'OK'
  END AS status
FROM voided_return_stock vrs
JOIN sale_returns sr ON sr.id = vrs.return_id
LEFT JOIN reversal_stock rs
  ON  rs.return_id   = vrs.return_id
  AND rs.product_id  = vrs.product_id
  AND (rs.variation_id = vrs.variation_id OR (rs.variation_id IS NULL AND vrs.variation_id IS NULL))
WHERE rs.qty_reversed IS NULL OR ABS(vrs.quantity - rs.qty_reversed) > 0.001
ORDER BY sr.created_at DESC;

-- Expected: 0 rows.

-- ─── CHECK 4 ─────────────────────────────────────────────────────────────────
-- Stale draft returns (draft status older than 7 days).
-- These are zombie rows — either finalize or void them.
-- Expected: 0 rows (or all are acknowledged work-in-progress).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sr.id,
  sr.return_no,
  sr.customer_name,
  sr.total,
  sr.created_at,
  NOW() - sr.created_at AS age,
  CASE WHEN sr.original_sale_id IS NULL THEN 'standalone' ELSE 'linked' END AS return_type
FROM sale_returns sr
WHERE sr.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.status = 'draft'
  AND sr.created_at < NOW() - INTERVAL '7 days'
ORDER BY sr.created_at;

-- ─── CHECK 5 ─────────────────────────────────────────────────────────────────
-- Orphan JEs: journal_entries with reference_type='sale_return' but no matching
-- sale_return row exists. These are dangling entries.
-- Expected: 0 rows.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  je.id            AS je_id,
  je.entry_no,
  je.reference_id,
  je.entry_date,
  je.is_void,
  je.action_fingerprint
FROM journal_entries je
WHERE je.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND je.reference_type = 'sale_return'
  AND NOT EXISTS (
    SELECT 1 FROM sale_returns sr WHERE sr.id = je.reference_id
  )
ORDER BY je.entry_date DESC;

-- Expected: 0 rows.

-- ─── CHECK 6 ─────────────────────────────────────────────────────────────────
-- Double-void detection: sale_return_void stock movements for non-void returns.
-- A sale_return_void movement should only exist when the return is void.
-- Expected: 0 rows.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  sm.id            AS movement_id,
  sm.reference_id  AS return_id,
  sr.return_no,
  sr.status        AS return_status,
  sm.product_id,
  sm.quantity,
  sm.created_at    AS movement_created_at
FROM stock_movements sm
JOIN sale_returns sr ON sr.id = sm.reference_id
WHERE sm.reference_type = 'sale_return'
  AND sm.movement_type  = 'sale_return_void'
  AND sr.company_id     = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND sr.status        != 'void'
ORDER BY sm.created_at DESC;

-- Expected: 0 rows.

-- ─── CHECK 7 ─────────────────────────────────────────────────────────────────
-- Sale JEs missing action_fingerprint (source-owned integrity).
-- All sale and sale_return JEs should have fingerprints post-standardization.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  je.reference_type,
  COUNT(*) FILTER (WHERE je.action_fingerprint IS NULL)     AS missing_fingerprint,
  COUNT(*) FILTER (WHERE je.action_fingerprint IS NOT NULL) AS has_fingerprint,
  MIN(je.entry_date) AS earliest_missing,
  MAX(je.entry_date) AS latest_missing
FROM journal_entries je
WHERE je.company_id = '595c08c2-1e47-4581-89c9-1f78de51c613'
  AND je.reference_type IN ('sale', 'sale_return')
  AND (je.is_void IS NULL OR je.is_void = FALSE)
GROUP BY je.reference_type;

-- Expected post-repair: missing_fingerprint = 0 for sale_return.
-- Historic sale JEs may still lack fingerprint (pre-standardization).
