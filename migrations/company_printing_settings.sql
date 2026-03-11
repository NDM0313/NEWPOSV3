-- Centralized ERP printing settings per company.
-- Used by Settings → Printing (Document Templates, Page Setup, Fields, Layout, Thermal, PDF).
-- All document types (Sales Invoice, Purchase Invoice, Ledger, Receipt, etc.) use this config.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS printing_settings JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN companies.printing_settings IS 'Unified printing config: pageSetup, fields, layout, thermal, pdf, documentTemplates, invoiceTypes';
