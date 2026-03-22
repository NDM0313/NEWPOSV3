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
    -- Payables: worker = unpaid worker_ledger (studio) else workers.current_balance else contact fields; supplier/both unchanged
    (CASE
       WHEN c.type = 'worker' THEN
         CASE
           WHEN EXISTS (
             SELECT 1 FROM worker_ledger_entries wle
             WHERE wle.company_id = p_company_id AND wle.worker_id = c.id
           )
           THEN GREATEST(0, COALESCE(
             (SELECT SUM(GREATEST(0, wle.amount::numeric))
              FROM worker_ledger_entries wle
              WHERE wle.company_id = p_company_id
                AND wle.worker_id = c.id
                AND (wle.status IS NULL OR LOWER(TRIM(wle.status::text)) <> 'paid')),
             0::numeric
           ))
           ELSE GREATEST(0, COALESCE(
             (SELECT w.current_balance::numeric FROM workers w WHERE w.id = c.id AND w.company_id = p_company_id LIMIT 1),
             c.current_balance,
             c.opening_balance,
             0
           )::numeric)
         END
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
       ELSE 0::numeric
     END) AS payables
  FROM contacts c
  WHERE c.company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.get_contact_balances_summary(UUID, UUID) IS
  'Per-contact receivables/payables. Workers: unpaid worker_ledger_entries (studio) when rows exist, else workers.current_balance.';
