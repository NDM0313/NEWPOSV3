-- Customer ledger RPC: exclude voided payments by default; optional audit mode; return payment_account_id for display.

DROP FUNCTION IF EXISTS public.get_customer_ledger_payments(UUID, UUID[], DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_customer_ledger_payments(
  p_company_id UUID,
  p_sale_ids UUID[],
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_include_voided BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  reference_number VARCHAR(100),
  payment_date DATE,
  amount DECIMAL(15, 2),
  payment_method VARCHAR(50),
  notes TEXT,
  reference_id UUID,
  payment_account_id UUID,
  voided_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id,
    p.reference_number,
    p.payment_date,
    p.amount,
    p.payment_method,
    p.notes,
    p.reference_id,
    p.payment_account_id,
    p.voided_at
  FROM public.payments p
  WHERE p.company_id = p_company_id
    AND p.reference_type = 'sale'
    AND p.reference_id = ANY(p_sale_ids)
    AND (p_include_voided OR p.voided_at IS NULL)
    AND (p_from_date IS NULL OR p.payment_date >= p_from_date)
    AND (p_to_date IS NULL OR p.payment_date <= p_to_date)
  ORDER BY p.payment_date DESC;
$$;

COMMENT ON FUNCTION public.get_customer_ledger_payments(UUID, UUID[], DATE, DATE, BOOLEAN) IS
  'Ledger: sale-linked payments; default excludes voided_at; set p_include_voided true for audit.';

GRANT EXECUTE ON FUNCTION public.get_customer_ledger_payments(UUID, UUID[], DATE, DATE, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_ledger_payments(UUID, UUID[], DATE, DATE, BOOLEAN) TO anon;
