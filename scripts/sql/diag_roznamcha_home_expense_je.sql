-- Roznamcha home expense diagnostics (JE-0015 / JE-0016 or any expense JEs).
-- Run in Supabase SQL Editor when Roznamcha shows wrong sign or missing wallet expense.

-- 1) JE lines + liquidity side
SELECT je.entry_no,
       je.reference_type,
       je.reference_id,
       je.payment_id,
       a.code,
       a.name,
       a.type,
       jel.debit,
       jel.credit
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.entry_no IN ('JE-0015', 'JE-0016')
ORDER BY je.entry_no, jel.debit DESC;

-- 2) Matching payments rows
SELECT p.reference_number,
       p.payment_type,
       p.reference_type,
       p.reference_id,
       p.amount,
       p.payment_method,
       p.payment_account_id,
       a.name AS account_name,
       p.voided_at
FROM payments p
LEFT JOIN accounts a ON a.id = p.payment_account_id
WHERE p.reference_type = 'expense'
  AND p.reference_id IN (
    SELECT reference_id
    FROM journal_entries
    WHERE entry_no IN ('JE-0015', 'JE-0016')
  );

-- 3) Orphan expense JEs (no payments row) — see preview_roznamcha_missing_expense_payments.sql
