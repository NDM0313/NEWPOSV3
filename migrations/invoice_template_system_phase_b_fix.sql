-- ============================================================================
-- Phase B fix: Add show_sku etc. when invoice_templates was created by
-- sale_actions_logging (different schema). Idempotent; safe after Phase B.
-- ============================================================================

-- Add Phase A columns if missing
ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS show_sku BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS show_discount BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS show_tax BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS show_studio BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS show_signature BOOLEAN NOT NULL DEFAULT false;

-- Backfill default A4/Thermal for companies that don't have them
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

-- RLS (idempotent)
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
