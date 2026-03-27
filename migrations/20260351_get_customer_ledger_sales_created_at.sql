-- Add created_at to get_customer_ledger_sales so client wide-fetch + local date filter works when
-- an older dated SQL predicate still drops NULL-invoice rows, and for diagnostics.
-- Keeps 20260350 behavior: final (case-insensitive), effective invoice_date = COALESCE(invoice_date, UTC date of created_at).
-- Idempotent column adds (safe if 20260350 already applied).

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shipment_charges NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS expenses NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) DEFAULT 0;

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
  shipment_charges DECIMAL(15,2),
  paid_amount DECIMAL(15,2),
  due_amount DECIMAL(15,2),
  payment_status VARCHAR(50),
  discount_amount DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  expenses DECIMAL(15,2),
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    s.id,
    s.invoice_no,
    COALESCE(s.invoice_date, (s.created_at AT TIME ZONE 'UTC')::date) AS invoice_date,
    s.total,
    COALESCE(s.shipment_charges, 0)::decimal(15,2),
    s.paid_amount,
    s.due_amount,
    s.payment_status,
    COALESCE(s.discount_amount, 0)::decimal(15,2),
    COALESCE(s.tax_amount, 0)::decimal(15,2),
    COALESCE(s.expenses, 0)::decimal(15,2),
    s.created_at
  FROM sales s
  WHERE s.company_id = p_company_id
    AND s.customer_id = p_customer_id
    AND LOWER(TRIM(COALESCE(s.status::text, ''))) = 'final'
    AND (
      p_from_date IS NULL
      OR COALESCE(s.invoice_date, (s.created_at AT TIME ZONE 'UTC')::date) >= p_from_date
    )
    AND (
      p_to_date IS NULL
      OR COALESCE(s.invoice_date, (s.created_at AT TIME ZONE 'UTC')::date) <= p_to_date
    )
  ORDER BY COALESCE(s.invoice_date, (s.created_at AT TIME ZONE 'UTC')::date) ASC, s.id ASC;
$$;

COMMENT ON FUNCTION get_customer_ledger_sales(UUID, UUID, DATE, DATE) IS
  'Customer ledger sales: final only (case-insensitive); effective date = invoice_date or UTC created_at date; includes shipment/discount/tax/expenses + created_at for client filters.';

GRANT EXECUTE ON FUNCTION get_customer_ledger_sales(UUID, UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_ledger_sales(UUID, UUID, DATE, DATE) TO anon;
