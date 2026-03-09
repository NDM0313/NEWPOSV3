-- ============================================================================
-- Invoice document: Studio row = final sale (with profit), Total = full invoice
-- ============================================================================
-- When studio_productions.generated_invoice_item_id is set, use that
-- sales_items.total as studio_charges (sale with profit), and grand_total = total.
-- ============================================================================

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
  v_studio_line_total NUMERIC := 0;
  v_studio_from_item BOOLEAN := FALSE;
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

  -- Studio line total (sale with profit): from generated_invoice_item_id when present
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_productions')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_productions' AND column_name = 'generated_invoice_item_id') THEN
    SELECT COALESCE(SUM(i.total), 0) INTO v_studio_line_total
    FROM sales_items i
    INNER JOIN studio_productions p ON p.generated_invoice_item_id = i.id AND p.sale_id = p_sale_id
    WHERE i.sale_id = p_sale_id;
    IF v_studio_line_total IS NULL THEN
      v_studio_line_total := 0;
    END IF;
    IF v_studio_line_total > 0 THEN
      v_studio_from_item := TRUE;
    END IF;
  END IF;
  IF NOT v_studio_from_item THEN
    v_studio_line_total := COALESCE(v_sale.studio_charges, 0);
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

  -- totals.total = full invoice total
  -- totals.studio_charges = studio line total from item when linked, else sales.studio_charges
  -- totals.grand_total = v_sale.total when studio line is in items (total already includes it), else total + studio_charges
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
    'studio_cost', v_studio_line_total,
    'payments', v_payments,
    'totals', jsonb_build_object(
      'subtotal', v_sale.subtotal,
      'discount', COALESCE(v_sale.discount_amount, 0),
      'tax', COALESCE(v_sale.tax_amount, 0),
      'expenses', COALESCE(v_sale.expenses, 0),
      'total', v_sale.total,
      'studio_charges', v_studio_line_total,
      'grand_total', CASE WHEN v_studio_from_item THEN v_sale.total ELSE (v_sale.total + v_studio_line_total) END,
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

COMMENT ON FUNCTION generate_invoice_document(UUID) IS 'Invoice document JSON. total/grand_total = full invoice; studio_charges = generated studio line total (sale with profit) when available.';
