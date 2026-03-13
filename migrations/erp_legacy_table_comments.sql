-- ERP Final Stabilization: Optional documentation comments on legacy tables.
-- Safe, idempotent. No schema or data changes; comments only.

COMMENT ON TABLE sale_items IS 'LEGACY: Prefer sales_items for new code. Fallback for reads; triggers/RLS here. Do not drop.';
COMMENT ON TABLE chart_accounts IS 'LEGACY: Posting uses accounts + journal_entries + journal_entry_lines. Not used by app. Do not drop.';
COMMENT ON TABLE document_sequences IS 'LEGACY: Prefer erp_document_sequences. Still used by credit notes, refunds, returns until migrated. Do not drop.';
