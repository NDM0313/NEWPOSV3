-- Fix: When get_user_company_id() is NULL (e.g. user not in public.users),
-- ledger RPC still returns rows for p_company_id so studio sale shows in customer ledger.

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
    AND (get_user_company_id() IS NULL OR s.company_id = get_user_company_id())
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
    AND (get_user_company_id() IS NULL OR p.company_id = get_user_company_id())
    AND p.reference_type = 'sale'
    AND p.reference_id = ANY(p_sale_ids)
    AND (p_from_date IS NULL OR p.payment_date >= p_from_date)
    AND (p_to_date IS NULL OR p.payment_date <= p_to_date)
  ORDER BY p.payment_date DESC;
$$;
