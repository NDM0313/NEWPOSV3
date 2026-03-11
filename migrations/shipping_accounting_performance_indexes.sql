-- ============================================================================
-- SHIPPING / COURIER ACCOUNTING — ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================
-- Ensures fast lookups for journal_entries by reference (shipment, courier_payment),
-- and shipment_history by company and date.
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================================

-- journal_entries: composite for common filters
CREATE INDEX IF NOT EXISTS idx_journal_entries_company_reference_type
  ON journal_entries (company_id, reference_type);

-- shipment_history: date range queries
CREATE INDEX IF NOT EXISTS idx_shipment_history_company_created
  ON shipment_history (company_id, created_at DESC);
