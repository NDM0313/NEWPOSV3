-- Dev verification: PF-14 payment edit chain (customer receipt).
-- Replace all occurrences of PAYMENT_UUID_HERE with public.payments.id (UUID string).
--
-- Expectations after a correct Ali-style chain (amount delta on OLD liquidity, then transfer of FINAL amount):
--   • Net (Dr − Cr) on the original receipt liquidity account across linked JEs → ~0
--   • Net on payments.payment_account_id → ~payments.amount (customer receipt)
--   • Amount-adjustment JE action_fingerprint (new format): payment_adjustment_amount:...:<old_liquidity_uuid>

-- Payment row (current truth)
SELECT id, amount, payment_account_id, reference_type, reference_id, payment_type, updated_at
FROM payments
WHERE id = 'PAYMENT_UUID_HERE';

-- Journal entries for this payment
SELECT id, entry_no, entry_date, reference_type, reference_id, payment_id, action_fingerprint, description
FROM journal_entries
WHERE company_id = (SELECT company_id FROM payments WHERE id = 'PAYMENT_UUID_HERE')
  AND (payment_id = 'PAYMENT_UUID_HERE' OR reference_id = 'PAYMENT_UUID_HERE')
  AND (is_void IS NULL OR is_void = false)
ORDER BY created_at;

-- Per-account net (Dr − Cr) for linked JEs
WITH je AS (
  SELECT id
  FROM journal_entries
  WHERE company_id = (SELECT company_id FROM payments WHERE id = 'PAYMENT_UUID_HERE')
    AND (payment_id = 'PAYMENT_UUID_HERE' OR reference_id = 'PAYMENT_UUID_HERE')
    AND (is_void IS NULL OR is_void = false)
)
SELECT
  l.account_id,
  a.code,
  a.name,
  SUM(COALESCE(l.debit, 0) - COALESCE(l.credit, 0)) AS net_dr_minus_cr
FROM journal_entry_lines l
JOIN je ON je.id = l.journal_entry_id
LEFT JOIN accounts a ON a.id = l.account_id
GROUP BY l.account_id, a.code, a.name
ORDER BY ABS(SUM(COALESCE(l.debit, 0) - COALESCE(l.credit, 0))) DESC;

-- PF-14 adjustment headers only
SELECT id, entry_no, action_fingerprint, description
FROM journal_entries
WHERE company_id = (SELECT company_id FROM payments WHERE id = 'PAYMENT_UUID_HERE')
  AND reference_type = 'payment_adjustment'
  AND reference_id = 'PAYMENT_UUID_HERE'
  AND (is_void IS NULL OR is_void = false);

-- Phase 4 mutation log (if migration applied)
SELECT *
FROM transaction_mutations
WHERE entity_type = 'payment'
  AND entity_id = 'PAYMENT_UUID_HERE'
ORDER BY created_at DESC;
