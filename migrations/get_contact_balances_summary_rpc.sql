-- RPC: get_contact_balances_summary(p_company_id, p_branch_id optional)
-- Returns one row per contact: contact_id, receivables, payables.
-- Use this instead of loading all sales + all purchases on the Contacts page.
CREATE OR REPLACE FUNCTION public.get_contact_balances_summary(
  p_company_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  contact_id UUID,
  receivables NUMERIC,
  payables NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS contact_id,
    -- Receivables: customer/both opening + sum(sales due) for this contact
    (CASE WHEN c.type IN ('customer', 'both') THEN GREATEST(0, COALESCE(c.opening_balance, 0)::numeric) ELSE 0 END)
    + COALESCE(
        (SELECT SUM(GREATEST(0, COALESCE(s.due_amount, (COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0)))::numeric))
         FROM sales s
         WHERE s.company_id = p_company_id
           AND s.customer_id = c.id
           AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
           AND (s.status IS NULL OR s.status != 'cancelled')),
        0
      ) AS receivables,
    -- Payables: worker = current_balance/opening; supplier/both = supplier_opening + sum(purchases due)
    (CASE
       WHEN c.type = 'worker' THEN GREATEST(0, COALESCE(c.current_balance, c.opening_balance, 0)::numeric)
       WHEN c.type IN ('supplier', 'both') THEN
         GREATEST(0, COALESCE(c.supplier_opening_balance, c.opening_balance, 0)::numeric)
         + COALESCE(
             (SELECT SUM(GREATEST(0, COALESCE(p.due_amount, (COALESCE(p.total, 0) - COALESCE(p.paid_amount, 0)))::numeric))
              FROM purchases p
              WHERE p.company_id = p_company_id
                AND p.supplier_id = c.id
                AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)),
             0
           )
       ELSE 0
     END) AS payables
  FROM contacts c
  WHERE c.company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.get_contact_balances_summary(UUID, UUID) IS
  'Returns per-contact receivables and payables for Contacts page. Reduces load vs fetching all sales and purchases.';
