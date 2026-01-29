-- ============================================================================
-- ENABLE PACKING – Global System Setting (Inventory)
-- ============================================================================
-- Setting: enable_packing (boolean, default OFF)
-- When OFF: packing (boxes/pieces) hidden everywhere; APIs ignore packing data.
-- When ON: full packing in Sale, Purchase, Inventory, Ledger, Print.
-- ============================================================================

-- Ensure settings table exists (from 03_frontend_driven_schema or similar)
-- and has (company_id, key) unique. No schema change needed if already present.

-- Optional: Insert default OFF for existing companies (run once if desired)
-- INSERT INTO settings (company_id, key, value, category, description)
-- SELECT id, 'enable_packing', 'false', 'inventory', 'Enable Packing (Boxes/Pieces) – when OFF, packing is hidden system-wide'
-- FROM companies
-- ON CONFLICT (company_id, key) DO NOTHING;

COMMENT ON TABLE settings IS 'Company-level key-value settings. enable_packing (inventory) controls packing visibility system-wide.';
