-- ============================================================================
-- Canonical purchase document JE: one active row per purchase (payment_id IS NULL)
-- ============================================================================
-- Root issue: purchase payment JEs can share reference_type='purchase' and reference_id
-- with the purchase document while setting payment_id. Those rows are NOT canonical
-- purchase document JEs and must not satisfy duplicate guards or Fresh posting gate.
--
-- This migration:
-- 1) Voids duplicate *canonical* (payment_id IS NULL) active purchase document JEs,
--    keeping the earliest by created_at (preview query in comments).
-- 2) Adds a partial unique index so at most one active canonical document JE
--    exists per purchase at the DB layer.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PREVIEW (run manually before apply if desired):
--
-- SELECT reference_id AS purchase_id,
--        COUNT(*)    AS active_canonical_je_count,
--        array_agg(id ORDER BY created_at NULLS LAST, id) AS je_ids
-- FROM journal_entries
-- WHERE reference_type = 'purchase'
--   AND payment_id IS NULL
--   AND COALESCE(is_void, false) = false
-- GROUP BY reference_id
-- HAVING COUNT(*) > 1;
--
-- Preview one purchase:
-- SELECT id, entry_no, entry_date, created_at, payment_id, is_void, description
-- FROM journal_entries
-- WHERE reference_type = 'purchase'
--   AND reference_id = '<PURCHASE_UUID>'::uuid
-- ORDER BY created_at NULLS LAST, id;
-- ---------------------------------------------------------------------------

-- 1) Repair: void duplicates (keep earliest canonical document JE per purchase)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY reference_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM journal_entries
  WHERE reference_type = 'purchase'
    AND payment_id IS NULL
    AND COALESCE(is_void, false) = false
)
UPDATE journal_entries je
SET
  is_void = true,
  void_reason = COALESCE(
    je.void_reason,
    'Duplicate canonical purchase document JE (20260312 migration; kept earliest by created_at)'
  ),
  voided_at = COALESCE(je.voided_at, NOW())
FROM ranked r
WHERE je.id = r.id
  AND r.rn > 1;

-- 2) Hard guarantee: one active canonical document JE per purchase
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_canonical_purchase_document_active
  ON journal_entries (reference_id)
  WHERE reference_type = 'purchase'
    AND payment_id IS NULL
    AND COALESCE(is_void, false) = false;

COMMENT ON INDEX idx_journal_entries_canonical_purchase_document_active IS
  'At most one active (non-void) canonical purchase document JE per purchase; payment-linked JEs use payment_id IS NOT NULL.';
