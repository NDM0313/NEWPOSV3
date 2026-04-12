-- PF-14.7 verification: payments row vs primary JE vs PF-14 account-change chain
-- Run in SQL editor after replacing :company_id and optionally :payment_id.

-- 1) Payment row (authoritative declared liquidity book after edits)
SELECT id, reference_type, reference_id, amount, payment_account_id, payment_date
FROM payments
WHERE company_id = :company_id
  AND (:payment_id::uuid IS NULL OR id = :payment_id::uuid)
ORDER BY updated_at DESC
LIMIT 20;

-- 2) Primary JE(s) for a payment — liquidity leg is usually STILL the original receipt account (immutable)
SELECT je.id, je.entry_no, je.reference_type, je.payment_id, je.description,
       jl.account_id, a.code, a.name, jl.debit, jl.credit
FROM journal_entries je
JOIN journal_entry_lines jl ON jl.journal_entry_id = je.id
LEFT JOIN accounts a ON a.id = jl.account_id
WHERE je.company_id = :company_id
  AND je.payment_id = :payment_id::uuid
  AND COALESCE(je.is_void, false) = false
  AND je.reference_type IS DISTINCT FROM 'payment_adjustment'
ORDER BY je.created_at;

-- 3) PF-14 "Payment account changed" JEs (transfer chain — authoritative for where cash moved after receipt)
SELECT je.id, je.entry_no, je.description, je.action_fingerprint, je.created_at
FROM journal_entries je
WHERE je.company_id = :company_id
  AND je.reference_type = 'payment_adjustment'
  AND je.reference_id = :payment_id::uuid
  AND je.description ILIKE '%Payment account changed%'
  AND COALESCE(je.is_void, false) = false
ORDER BY je.created_at;

-- 4) Suspect duplicate replay: same payment has BOTH PF-14 transfers AND extra "Payment account changed"
--    from load-sync would often be Dr final_bank Cr original_petty for FULL amount while (3) already moved chain.
--    Inspect entry_no / lines manually before voiding.
