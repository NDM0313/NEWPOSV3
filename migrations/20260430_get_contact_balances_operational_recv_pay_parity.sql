-- Ensure void filter column exists (introduced in 20260356; safe if already present).
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

-- Contacts operational recv/pay parity (get_contact_balances_summary):
-- 1) Payables: subtract supplier-side cash outflows not already netted in purchase rows:
--    payment_type = 'paid' AND reference_type IN ('manual_payment', 'on_account').
--    Purchase-linked payments (reference_type = 'purchase') remain reflected via purchases.paid_amount/due_amount + recalc_purchase_payment_totals — do not subtract again.
-- 2) Receivables: exclude voided customer prepayments (voided_at IS NULL) on the manual_receipt/on_account subtract leg.
-- 3) Reassert branch parity: when p_branch_id is set, include payments/documents with branch_id IS NULL (company-wide) OR matching branch.

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
             AND (p.voided_at IS NULL)
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
               (SELECT SUM(GREATEST(0, COALESCE(pur.due_amount, (COALESCE(pur.total, 0) - COALESCE(pur.paid_amount, 0)))::numeric))
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
           - COALESCE(
               (SELECT SUM(GREATEST(0, pay.amount::numeric))
                FROM payments pay
                WHERE pay.company_id = p_company_id
                  AND pay.contact_id = c.id
                  AND LOWER(TRIM(COALESCE(pay.payment_type::text, ''))) = 'paid'
                  AND (pay.voided_at IS NULL)
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
  'Operational recv/pay per contact. Recv: customer/both opening + final sales due − non-void manual_receipt/on_account receipts (sale-linked receipts net via sales.due). Pay: supplier/both supplier_opening + final/received purchase due − non-void manual_payment/on_account supplier payments (purchase-linked net via purchases.due). Branch: NULL branch_id documents/payments included when a branch filter is set.';

GRANT EXECUTE ON FUNCTION public.get_contact_balances_summary(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contact_balances_summary(UUID, UUID) TO service_role;
