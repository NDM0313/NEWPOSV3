-- ============================================================================
-- Phase A: Controlled Standard Invoice Template System
-- ============================================================================
-- 1. fiscal_calendar – period lookup for invoice meta
-- 2. invoice_templates – per-company A4/Thermal display options
-- 3. RPC generate_invoice_document(sale_id) – single source for invoice JSON
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FISCAL_CALENDAR
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fiscal_year VARCHAR(20) NOT NULL,
  period_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fiscal_calendar_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_calendar_company ON fiscal_calendar(company_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_calendar_dates ON fiscal_calendar(start_date, end_date);
COMMENT ON TABLE fiscal_calendar IS 'Fiscal periods for reporting and invoice meta. Optional; when absent, fiscal_period in document is null.';

-- ----------------------------------------------------------------------------
-- 2. INVOICE_TEMPLATES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_type VARCHAR(20) NOT NULL DEFAULT 'A4' CHECK (template_type IN ('A4', 'Thermal')),
  show_sku BOOLEAN NOT NULL DEFAULT true,
  show_discount BOOLEAN NOT NULL DEFAULT true,
  show_tax BOOLEAN NOT NULL DEFAULT true,
  show_studio BOOLEAN NOT NULL DEFAULT true,
  show_signature BOOLEAN NOT NULL DEFAULT false,
  logo_url TEXT,
  footer_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, template_type)
);

CREATE INDEX IF NOT EXISTS idx_invoice_templates_company ON invoice_templates(company_id);
COMMENT ON TABLE invoice_templates IS 'Per-company invoice display options for A4 and Thermal. Single row per (company_id, template_type).';

-- ----------------------------------------------------------------------------
-- 3. RPC: generate_invoice_document(p_sale_id)
-- Returns JSON: company, customer, items, studio_cost, payments, totals, meta (with fiscal_period)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_invoice_document(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_company RECORD;
  v_customer RECORD;
  v_items JSONB;
  v_payments JSONB;
  v_fiscal_period TEXT;
  v_doc JSONB;
BEGIN
  IF p_sale_id IS NULL THEN
    RETURN json_build_object('error', 'sale_id is required');
  END IF;

  SELECT
    s.id,
    s.company_id,
    s.branch_id,
    s.invoice_no,
    s.invoice_date,
    s.customer_id,
    s.customer_name,
    s.type,
    s.status,
    s.subtotal,
    s.discount_amount,
    s.tax_amount,
    s.expenses,
    s.total,
    COALESCE(s.studio_charges, 0) AS studio_charges,
    s.paid_amount,
    s.due_amount,
    s.notes,
    s.payment_status,
    s.payment_method
  INTO v_sale
  FROM sales s
  WHERE s.id = p_sale_id;

  IF v_sale.id IS NULL THEN
    RETURN json_build_object('error', 'Sale not found');
  END IF;

  SELECT c.id, c.name AS company_name
  INTO v_company
  FROM companies c
  WHERE c.id = v_sale.company_id;

  SELECT co.id, co.name, co.phone
  INTO v_customer
  FROM contacts co
  WHERE co.id = v_sale.customer_id;

  -- Items: from sales_items or sale_items (backward compatibility)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_items') THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'product_name', i.product_name,
        'sku', i.sku,
        'quantity', i.quantity,
        'unit', COALESCE(i.unit, 'pcs'),
        'unit_price', i.unit_price,
        'discount_amount', COALESCE(i.discount_amount, 0),
        'tax_amount', COALESCE(i.tax_amount, 0),
        'total', i.total,
        'packing_details', i.packing_details
      ) ORDER BY (SELECT 0)
    ) INTO v_items FROM sales_items i WHERE i.sale_id = p_sale_id;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sale_items') THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'product_name', i.product_name,
        'sku', i.sku,
        'quantity', i.quantity,
        'unit', COALESCE(i.unit, 'pcs'),
        'unit_price', i.unit_price,
        'discount_amount', COALESCE(i.discount_amount, 0),
        'tax_amount', COALESCE(i.tax_amount, 0),
        'total', i.total,
        'packing_details', i.packing_details
      ) ORDER BY (SELECT 0)
    ) INTO v_items FROM sale_items i WHERE i.sale_id = p_sale_id;
  ELSE
    v_items := '[]'::jsonb;
  END IF;

  IF v_items IS NULL THEN
    v_items := '[]'::jsonb;
  END IF;

  -- Payments (customer receipts only)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'amount', p.amount,
        'payment_method', p.payment_method,
        'payment_date', p.payment_date,
        'reference_number', p.reference_number
      ) ORDER BY p.payment_date, p.created_at
    ),
    '[]'::jsonb
  ) INTO v_payments
  FROM payments p
  WHERE p.reference_type = 'sale' AND p.reference_id = p_sale_id;

  IF v_payments IS NULL THEN
    v_payments := '[]'::jsonb;
  END IF;

  -- Fiscal period (optional)
  SELECT fc.period_name INTO v_fiscal_period
  FROM fiscal_calendar fc
  WHERE fc.company_id = v_sale.company_id
    AND v_sale.invoice_date::date BETWEEN fc.start_date AND fc.end_date
  LIMIT 1;

  v_doc := jsonb_build_object(
    'company', jsonb_build_object(
      'id', v_company.id,
      'name', COALESCE(v_company.company_name, ''),
      'address', NULL
    ),
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'name', COALESCE(v_sale.customer_name, v_customer.name, ''),
      'contact_number', COALESCE(v_customer.phone, ''),
      'address', NULL
    ),
    'items', v_items,
    'studio_cost', COALESCE(v_sale.studio_charges, 0),
    'payments', v_payments,
    'totals', jsonb_build_object(
      'subtotal', v_sale.subtotal,
      'discount', COALESCE(v_sale.discount_amount, 0),
      'tax', COALESCE(v_sale.tax_amount, 0),
      'expenses', COALESCE(v_sale.expenses, 0),
      'total', v_sale.total,
      'studio_charges', COALESCE(v_sale.studio_charges, 0),
      'grand_total', (v_sale.total + COALESCE(v_sale.studio_charges, 0)),
      'paid', v_sale.paid_amount,
      'due', v_sale.due_amount
    ),
    'meta', jsonb_build_object(
      'sale_id', p_sale_id,
      'invoice_no', v_sale.invoice_no,
      'invoice_date', v_sale.invoice_date,
      'fiscal_period', v_fiscal_period,
      'status', v_sale.status,
      'type', v_sale.type,
      'payment_status', v_sale.payment_status,
      'notes', v_sale.notes,
      'branch_id', v_sale.branch_id
    )
  );

  RETURN v_doc;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION generate_invoice_document(UUID) IS 'Phase A: Single source for invoice document JSON. Used by A4/Thermal templates. Includes fiscal_period from fiscal_calendar when available.';

-- Optional: insert default fiscal year row per company (no-op if no companies)
DO $$
BEGIN
  INSERT INTO fiscal_calendar (company_id, start_date, end_date, fiscal_year, period_name)
  SELECT id, date_trunc('year', CURRENT_DATE)::date, (date_trunc('year', CURRENT_DATE) + interval '1 year - 1 day')::date,
         TO_CHAR(CURRENT_DATE, 'YYYY'), 'FY ' || TO_CHAR(CURRENT_DATE, 'YYYY')
  FROM companies c
  WHERE NOT EXISTS (SELECT 1 FROM fiscal_calendar fc WHERE fc.company_id = c.id LIMIT 1)
  LIMIT 1;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
