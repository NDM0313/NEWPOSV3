-- Contacts operational receivable/payable (get_contact_balances_summary):
-- 1) Branch scope matches GL / party GL: when p_branch_id is set, include document rows with branch_id IS NULL
--    (company-wide / legacy) OR matching branch — strict equality alone hid final sales from Contacts when the sale
--    row had NULL branch_id and the UI filtered a specific branch (opening still showed → looked like "both-only" bug).
-- 2) Keep 20260353 semantics: final sales only; subtract manual_receipt + on_account received payments (not sale-linked);
--    purchases final/received; customer + both share the receivable leg; supplier + both share the payable leg.
--
-- NOTE: Root `migrations/get_contact_balances_summary*.sql` sort AFTER digit-prefixed files and used to REPLACE this
-- function with older strict-branch + non-final filters — those files are neutralized (no-op) so this definition wins.

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
    GREATEST(
      0::numeric,
      (CASE WHEN c.type IN ('customer', 'both') THEN GREATEST(0, COALESCE(c.opening_balance, 0)::numeric) ELSE 0 END)
      + COALESCE(
          (SELECT SUM(GREATEST(0, COALESCE(s.due_amount, (COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0)))::numeric))
           FROM sales s
           WHERE s.company_id = p_company_id
             AND s.customer_id = c.id
             AND (
               p_branch_id IS NULL
               OR s.branch_id IS NULL
               OR s.branch_id = p_branch_id
             )
             AND LOWER(TRIM(COALESCE(s.status::text, ''))) = 'final'),
          0
        )
      - COALESCE(
          (SELECT SUM(GREATEST(0, p.amount::numeric))
           FROM payments p
           WHERE p.company_id = p_company_id
             AND p.contact_id = c.id
             AND LOWER(TRIM(COALESCE(p.payment_type::text, ''))) = 'received'
             AND (
               p_branch_id IS NULL
               OR p.branch_id IS NULL
               OR p.branch_id = p_branch_id
             )
             AND LOWER(TRIM(COALESCE(p.reference_type::text, ''))) IN ('manual_receipt', 'on_account')),
          0
        )
    ) AS receivables,
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
                AND (
                  p_branch_id IS NULL
                  OR p.branch_id IS NULL
                  OR p.branch_id = p_branch_id
                )
                AND LOWER(TRIM(COALESCE(p.status::text, ''))) IN ('final', 'received')),
             0
           )
       ELSE 0::numeric
     END) AS payables
  FROM contacts c
  WHERE c.company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.get_contact_balances_summary(UUID, UUID) IS
  'Per-contact operational recv/pay. Recv: opening (customer+both) + final sales due − manual_receipt/on_account receipts; branch filter includes NULL branch_id documents. Pay: supplier+both purchases final/received + opening; same branch rule.';

GRANT EXECUTE ON FUNCTION public.get_contact_balances_summary(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contact_balances_summary(UUID, UUID) TO service_role;
