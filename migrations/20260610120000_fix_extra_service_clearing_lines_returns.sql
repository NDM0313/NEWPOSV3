-- Fix extra_service_clearing_lines: single overload, explicit casts (42804 return-type mismatch).

SET search_path = public;

DROP FUNCTION IF EXISTS public.extra_service_clearing_lines(UUID, UUID);
DROP FUNCTION IF EXISTS public.extra_service_clearing_lines(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.extra_service_clearing_lines(
  p_company_id UUID,
  p_tailor_contact_id UUID DEFAULT NULL,
  p_expense_category_id UUID DEFAULT NULL
)
RETURNS TABLE (
  sale_charge_id UUID,
  sale_id UUID,
  invoice_no TEXT,
  charge_type TEXT,
  amount NUMERIC,
  charged_to_customer BOOLEAN,
  tailor_contact_id UUID,
  expense_category_id UUID,
  tailor_name TEXT,
  open_balance NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id::uuid,
    sc.sale_id::uuid,
    COALESCE(s.invoice_no, s.order_no, s.id::text)::text,
    sc.charge_type::text,
    sc.amount::numeric,
    COALESCE(sc.charged_to_customer, true)::boolean,
    sc.tailor_contact_id::uuid,
    sc.expense_category_id::uuid,
    COALESCE(ec.name, c.name)::text,
    public.open_4120_balance_for_sale_charge(sc.id)::numeric
  FROM public.sale_charges sc
  INNER JOIN public.sales s ON s.id = sc.sale_id
  LEFT JOIN public.contacts c ON c.id = sc.tailor_contact_id
  LEFT JOIN public.expense_categories ec ON ec.id = sc.expense_category_id
  WHERE s.company_id = p_company_id
    AND LOWER(TRIM(COALESCE(sc.charge_type, ''))) NOT IN ('discount', 'shipping')
    AND COALESCE(sc.amount, 0) > 0.005
    AND (p_tailor_contact_id IS NULL OR sc.tailor_contact_id = p_tailor_contact_id)
    AND (p_expense_category_id IS NULL OR sc.expense_category_id = p_expense_category_id)
    AND public.open_4120_balance_for_sale_charge(sc.id) > 0.005
  ORDER BY s.created_at DESC, sc.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.extra_service_clearing_lines(UUID, UUID, UUID) IS
  'Open 4120 balances per sale extra charge for expenditure clearing UI.';
