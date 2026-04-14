-- Self-healing operational payable: compute purchase due inline with finalized return subtraction.
-- Removes dependency on denormalized purchases.due_amount being up-to-date (trigger may not have applied).
-- Also subtracts standalone purchase returns (original_purchase_id IS NULL) from supplier payable.
-- Idempotent: CREATE OR REPLACE.

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
          (SELECT SUM(
             GREATEST(
               0::numeric,
               p.amount::numeric - COALESCE((
                 SELECT SUM(pa.allocated_amount)::numeric
                 FROM payment_allocations pa
                 WHERE pa.payment_id = p.id
               ), 0::numeric)
             )
           )
           FROM payments p
           WHERE p.company_id = p_company_id
             AND p.contact_id = c.id
             AND LOWER(TRIM(COALESCE(p.payment_type::text, ''))) = 'received'
             AND p.voided_at IS NULL
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
         GREATEST(
           0::numeric,
           GREATEST(0, COALESCE(c.supplier_opening_balance, c.opening_balance, 0)::numeric)
           + COALESCE(
               -- Inline due computation: purchase total minus finalized returns minus paid.
               -- This is self-healing: does NOT rely on purchases.due_amount being up-to-date.
               (SELECT SUM(GREATEST(0,
                 COALESCE(pur.total, 0)
                 - COALESCE(
                   (SELECT SUM(pr.total)
                    FROM purchase_returns pr
                    WHERE pr.original_purchase_id = pur.id
                      AND LOWER(TRIM(COALESCE(pr.status::text, ''))) = 'final'),
                   0)
                 - COALESCE(pur.paid_amount, 0)
               )::numeric)
                FROM purchases pur
                WHERE pur.company_id = p_company_id
                  AND pur.supplier_id = c.id
                  AND (
                    p_branch_id IS NULL
                    OR pur.branch_id IS NULL
                    OR pur.branch_id = p_branch_id
                  )
                  AND LOWER(TRIM(COALESCE(pur.status::text, ''))) IN ('final', 'received')),
               0
             )
           -- Standalone purchase returns (not linked to any purchase): subtract directly.
           - COALESCE(
               (SELECT SUM(spr.total)::numeric
                FROM purchase_returns spr
                WHERE spr.company_id = p_company_id
                  AND spr.supplier_id = c.id
                  AND spr.original_purchase_id IS NULL
                  AND LOWER(TRIM(COALESCE(spr.status::text, ''))) = 'final'
                  AND (
                    p_branch_id IS NULL
                    OR spr.branch_id IS NULL
                    OR spr.branch_id = p_branch_id
                  )),
               0
             )
           - COALESCE(
               (SELECT SUM(
                  GREATEST(
                    0::numeric,
                    pay.amount::numeric - COALESCE((
                      SELECT SUM(pa.allocated_amount)::numeric
                      FROM payment_allocations pa
                      WHERE pa.payment_id = pay.id
                    ), 0::numeric)
                  )
                )
                FROM payments pay
                WHERE pay.company_id = p_company_id
                  AND pay.contact_id = c.id
                  AND LOWER(TRIM(COALESCE(pay.payment_type::text, ''))) = 'paid'
                  AND pay.voided_at IS NULL
                  AND (
                    p_branch_id IS NULL
                    OR pay.branch_id IS NULL
                    OR pay.branch_id = p_branch_id
                  )
                  AND LOWER(TRIM(COALESCE(pay.reference_type::text, ''))) IN ('manual_payment', 'on_account')),
               0
             )
         )
       ELSE 0::numeric
     END) AS payables
  FROM contacts c
  WHERE c.company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.get_contact_balances_summary(UUID, UUID) IS
  'Operational recv/pay — self-healing variant. Supplier payable: opening + inline(purchase.total − finalized returns − paid) − standalone returns − unallocated manual_payment/on_account.';

GRANT EXECUTE ON FUNCTION public.get_contact_balances_summary(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contact_balances_summary(UUID, UUID) TO service_role;
