-- ============================================
-- PART 3 – LEDGER RPC: get_customer_ledger_rentals
-- ============================================
-- Frontend (customerLedgerApi, accountingService) calls:
--   supabase.rpc('get_customer_ledger_rentals', {
--     p_company_id, p_customer_id, p_from_date, p_to_date
--   })
-- and expects rows with: id, pickup_date, booking_date, created_at, total_amount
-- (and optional return_date, actual_return_date, status for display).
-- Drop first to avoid "cannot change return type of existing function" when signature changes.
DROP FUNCTION IF EXISTS get_customer_ledger_rentals(UUID, UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_customer_ledger_rentals(
  p_company_id UUID,
  p_customer_id UUID,
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  booking_no VARCHAR(50),
  booking_date DATE,
  pickup_date DATE,
  return_date DATE,
  actual_return_date DATE,
  status rental_status,
  total_amount DECIMAL(15,2),
  paid_amount DECIMAL(15,2),
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    r.id,
    r.booking_no,
    r.booking_date,
    r.pickup_date,
    r.return_date,
    r.actual_return_date,
    r.status,
    r.total_amount,
    r.paid_amount,
    r.created_at
  FROM rentals r
  WHERE r.company_id = p_company_id
    AND r.customer_id = p_customer_id
    AND (p_from_date IS NULL OR r.booking_date >= p_from_date)
    AND (p_to_date IS NULL OR r.booking_date <= p_to_date)
  ORDER BY r.booking_date DESC, r.created_at DESC;
$$;

COMMENT ON FUNCTION get_customer_ledger_rentals(UUID,UUID,DATE,DATE) IS 'Ledger: rentals for customer by company_id + customer_id; optional date filter on booking_date';

GRANT EXECUTE ON FUNCTION get_customer_ledger_rentals(UUID,UUID,DATE,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_ledger_rentals(UUID,UUID,DATE,DATE) TO anon;
