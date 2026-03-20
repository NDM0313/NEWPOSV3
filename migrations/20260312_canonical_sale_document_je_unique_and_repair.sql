-- ============================================================================
-- Canonical sale document JE: one active row per sale (payment_id IS NULL)
-- ============================================================================
-- Root issue: create_payment_journal_entry() sets journal_entries.reference_type
-- = 'sale' and reference_id = sale id WITH payment_id set. Those are NOT document
-- JEs. Legacy duplicate checks / lab counts that only filtered reference_type
-- 'sale' treated payment receipts as document JEs, and missed idempotency when
-- payments were inserted before the document JE.
--
-- This migration:
-- 1) Voids duplicate *canonical* (payment_id IS NULL) active sale document JEs,
--    keeping the earliest by created_at (preview query in comments).
-- 2) Adds a partial unique index so at most one active canonical document JE
--    exists per sale at the DB layer.
--
-- Apply after: journal_entries.is_void / void_reason / payment_id exist
-- (see migrations/pf145_backup_tables_and_fingerprint.sql, payment engine).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PREVIEW (run manually before apply if desired):
--
-- SELECT reference_id AS sale_id,
--        COUNT(*)    AS active_canonical_je_count,
--        array_agg(id ORDER BY created_at NULLS LAST, id) AS je_ids
-- FROM journal_entries
-- WHERE reference_type = 'sale'
--   AND payment_id IS NULL
--   AND COALESCE(is_void, false) = false
-- GROUP BY reference_id
-- HAVING COUNT(*) > 1;
--
-- Preview one sale:
-- SELECT id, entry_no, entry_date, created_at, payment_id, is_void, description
-- FROM journal_entries
-- WHERE reference_type = 'sale'
--   AND reference_id = '<SALE_UUID>'::uuid
-- ORDER BY created_at NULLS LAST, id;
-- ---------------------------------------------------------------------------

-- 1) Repair: void duplicates (keep earliest canonical document JE per sale)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY reference_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM journal_entries
  WHERE reference_type = 'sale'
    AND payment_id IS NULL
    AND COALESCE(is_void, false) = false
)
UPDATE journal_entries je
SET
  is_void = true,
  void_reason = COALESCE(
    je.void_reason,
    'Duplicate canonical sale document JE (20260312 migration; kept earliest by created_at)'
  ),
  voided_at = COALESCE(je.voided_at, NOW())
FROM ranked r
WHERE je.id = r.id
  AND r.rn > 1;

-- 2) Hard guarantee: one active canonical document JE per sale
CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_canonical_sale_document_active
  ON journal_entries (reference_id)
  WHERE reference_type = 'sale'
    AND payment_id IS NULL
    AND COALESCE(is_void, false) = false;

COMMENT ON INDEX idx_journal_entries_canonical_sale_document_active IS
  'At most one active (non-void) canonical sale document JE per sale; payment receipts use payment_id IS NOT NULL.';
