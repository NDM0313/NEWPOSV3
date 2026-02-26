-- ============================================================================
-- Phase B (next steps): Default invoice templates + RLS for invoice_templates
-- Auto-apply: run-migrations.js will run this after Phase A.
-- If invoice_templates was created by sale_actions_logging.sql (no show_sku etc.),
-- we add Phase A columns here so backfill and app work.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Add Phase A columns if missing (table may exist from sale_actions_logging)
-- ----------------------------------------------------------------------------
ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS show_sku BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS show_discount BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS show_tax BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS show_studio BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS show_signature BOOLEAN NOT NULL DEFAULT false;
-- logo_url, footer_note may already exist from sale_actions_logging

-- ----------------------------------------------------------------------------
-- 1. Backfill: Ensure every company has A4 and Thermal template rows
-- ----------------------------------------------------------------------------
INSERT INTO invoice_templates (
  company_id,
  template_type,
  show_sku,
  show_discount,
  show_tax,
  show_studio,
  show_signature,
  logo_url,
  footer_note
)
SELECT c.id, 'A4', true, true, true, true, false, NULL, NULL
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM invoice_templates t WHERE t.company_id = c.id AND t.template_type = 'A4')
ON CONFLICT (company_id, template_type) DO NOTHING;

INSERT INTO invoice_templates (
  company_id,
  template_type,
  show_sku,
  show_discount,
  show_tax,
  show_studio,
  show_signature,
  logo_url,
  footer_note
)
SELECT c.id, 'Thermal', true, true, true, true, false, NULL, NULL
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM invoice_templates t WHERE t.company_id = c.id AND t.template_type = 'Thermal')
ON CONFLICT (company_id, template_type) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. RLS: Allow authenticated users to read/update their company's templates
-- ----------------------------------------------------------------------------
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_templates_select_company" ON invoice_templates;
CREATE POLICY "invoice_templates_select_company"
  ON invoice_templates FOR SELECT TO authenticated
  USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "invoice_templates_insert_company" ON invoice_templates;
CREATE POLICY "invoice_templates_insert_company"
  ON invoice_templates FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "invoice_templates_update_company" ON invoice_templates;
CREATE POLICY "invoice_templates_update_company"
  ON invoice_templates FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

COMMENT ON TABLE invoice_templates IS 'Per-company A4/Thermal options. Phase B: default rows backfilled; RLS by company.';
