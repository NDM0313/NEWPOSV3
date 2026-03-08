-- Customer Ledger: only final invoices (exclude STD orders / draft / quotation)
-- Prevents double accounting: STD = Customer Order (no receivable); only SL = Invoice (receivable).
-- get_customer_ledger_sales must return only sales that create receivable (status = 'final').

DROP FUNCTION IF EXISTS get_customer_ledger_sales(UUID, UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_customer_ledger_sales(
  p_company_id UUID,
  p_customer_id UUID,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  invoice_no VARCHAR(100),
  invoice_date DATE,
  total DECIMAL(15,2),
  paid_amount DECIMAL(15,2),
  due_amount DECIMAL(15,2),
  payment_status VARCHAR(50)
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT s.id, s.invoice_no, s.invoice_date, s.total, s.paid_amount, s.due_amount, s.payment_status
  FROM sales s
  WHERE s.company_id = p_company_id
    AND s.customer_id = p_customer_id
    AND s.status = 'final'
    AND (p_from_date IS NULL OR s.invoice_date >= p_from_date)
    AND (p_to_date IS NULL OR s.invoice_date <= p_to_date)
  ORDER BY s.invoice_date DESC;
$$;

COMMENT ON FUNCTION get_customer_ledger_sales(UUID,UUID,DATE,DATE) IS 'Ledger: only final invoices (status=final). Excludes STD/order/draft to avoid double accounting.';

GRANT EXECUTE ON FUNCTION get_customer_ledger_sales(UUID,UUID,DATE,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_ledger_sales(UUID,UUID,DATE,DATE) TO anon;
