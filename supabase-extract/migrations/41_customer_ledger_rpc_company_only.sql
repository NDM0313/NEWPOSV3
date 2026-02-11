-- Ledger RPC: sirf p_company_id + p_customer_id use karo (get_user_company_id hatao)
-- App context se company_id aata hai; isse studio sale har branch/customer ledger mein dikhegi

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
    AND (p_from_date IS NULL OR s.invoice_date >= p_from_date)
    AND (p_to_date IS NULL OR s.invoice_date <= p_to_date)
  ORDER BY s.invoice_date DESC;
$$;

CREATE OR REPLACE FUNCTION get_customer_ledger_payments(
  p_company_id UUID,
  p_sale_ids UUID[],
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  reference_number VARCHAR(100),
  payment_date DATE,
  amount DECIMAL(15,2),
  payment_method VARCHAR(50),
  notes TEXT,
  reference_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.reference_number, p.payment_date, p.amount, p.payment_method, p.notes, p.reference_id
  FROM payments p
  WHERE p.company_id = p_company_id
    AND p.reference_type = 'sale'
    AND p.reference_id = ANY(p_sale_ids)
    AND (p_from_date IS NULL OR p.payment_date >= p_from_date)
    AND (p_to_date IS NULL OR p.payment_date <= p_to_date)
  ORDER BY p.payment_date DESC;
$$;

COMMENT ON FUNCTION get_customer_ledger_sales(UUID,UUID,DATE,DATE) IS 'Ledger: sales by company_id + customer_id only (no auth check)';
COMMENT ON FUNCTION get_customer_ledger_payments(UUID,UUID[],DATE,DATE) IS 'Ledger: payments by company_id + sale_ids only (no auth check)';

-- App (browser) uses anon/authenticated key to call these RPCs
GRANT EXECUTE ON FUNCTION get_customer_ledger_sales(UUID,UUID,DATE,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_ledger_sales(UUID,UUID,DATE,DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_customer_ledger_payments(UUID,UUID[],DATE,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_ledger_payments(UUID,UUID[],DATE,DATE) TO anon;
