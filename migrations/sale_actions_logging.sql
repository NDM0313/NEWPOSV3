-- ============================================================================
-- Sale Actions: share_logs, print_logs, log_sale_action RPC
-- Enterprise-level audit for Share / Print / Download and generic action log.
-- Run in Supabase SQL Editor or apply via migration runner.
-- ============================================================================

-- Share logs: who shared what and how
CREATE TABLE IF NOT EXISTS share_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  share_type TEXT NOT NULL CHECK (share_type IN ('whatsapp', 'pdf', 'link')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_logs_sale_id ON share_logs(sale_id);
CREATE INDEX IF NOT EXISTS idx_share_logs_shared_at ON share_logs(shared_at);
CREATE INDEX IF NOT EXISTS idx_share_logs_share_type ON share_logs(share_type);

COMMENT ON TABLE share_logs IS 'Audit: invoice/share actions (WhatsApp, PDF, link)';

-- Print logs: who printed and which format
CREATE TABLE IF NOT EXISTS print_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  printed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  printed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  print_type TEXT NOT NULL CHECK (print_type IN ('A4', 'Thermal', 'thermal_80mm', 'thermal_58mm')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_logs_sale_id ON print_logs(sale_id);
CREATE INDEX IF NOT EXISTS idx_print_logs_printed_at ON print_logs(printed_at);
CREATE INDEX IF NOT EXISTS idx_print_logs_print_type ON print_logs(print_type);

COMMENT ON TABLE print_logs IS 'Audit: invoice print actions (A4, Thermal)';

-- Optional: invoice_templates for global design (single source of truth)
CREATE TABLE IF NOT EXISTS invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL CHECK (template_type IN ('A4', 'Thermal', 'thermal_80mm', 'thermal_58mm')),
  name TEXT,
  logo_url TEXT,
  company_info JSONB DEFAULT '{}',
  footer_note TEXT,
  format_settings JSONB DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, template_type)
);

CREATE INDEX IF NOT EXISTS idx_invoice_templates_company ON invoice_templates(company_id);

COMMENT ON TABLE invoice_templates IS 'Global invoice design (Sale, Payment Receipt, Return, Studio Bill)';

-- RPC: log a sale action for audit (share, print, download, view, etc.)
-- Uses activity_logs if present (module='sale', entity_id=sale_id).
CREATE OR REPLACE FUNCTION log_sale_action(
  p_sale_id UUID,
  p_action_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_company_id UUID;
  v_invoice_no TEXT;
BEGIN
  SELECT company_id, invoice_no INTO v_company_id, v_invoice_no FROM sales WHERE id = p_sale_id LIMIT 1;
  IF v_company_id IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO activity_logs (
    company_id,
    module,
    entity_id,
    entity_reference,
    action,
    performed_by,
    description
  ) VALUES (
    v_company_id,
    'sale',
    p_sale_id,
    v_invoice_no,
    p_action_type,
    p_user_id,
    'Sale action: ' || p_action_type
  )
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
EXCEPTION
  WHEN undefined_table THEN
    RETURN NULL;
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION log_sale_action(UUID, TEXT, UUID, JSONB) IS 'Audit: log sale action (share_whatsapp, share_pdf, print_a4, print_thermal, download_pdf, view_details, etc.)';

-- RPC: log share (inserts into share_logs and optionally activity_logs)
CREATE OR REPLACE FUNCTION log_share(
  p_sale_id UUID,
  p_share_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO share_logs (sale_id, shared_by, shared_at, share_type, metadata)
  VALUES (p_sale_id, p_user_id, NOW(), p_share_type, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION log_share(UUID, TEXT, UUID, JSONB) IS 'Audit: log share action (whatsapp/pdf/link)';

-- RPC: log print (inserts into print_logs)
CREATE OR REPLACE FUNCTION log_print(
  p_sale_id UUID,
  p_print_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO print_logs (sale_id, printed_by, printed_at, print_type, metadata)
  VALUES (p_sale_id, p_user_id, NOW(), p_print_type, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION log_print(UUID, TEXT, UUID, JSONB) IS 'Audit: log print action (A4/Thermal)';
