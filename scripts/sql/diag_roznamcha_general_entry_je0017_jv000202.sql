-- Roznamcha general-entry diagnostics (JE-0017 / JV-000202).
-- Run: ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres" < scripts/sql/diag_roznamcha_general_entry_je0017_jv000202.sql

-- 1) JE header + branch
SELECT je.id AS journal_entry_id,
       je.entry_no,
       je.entry_date,
       je.reference_type,
       je.reference_id,
       je.payment_id,
       je.branch_id AS je_branch_id,
       je.company_id,
       je.description,
       je.is_void,
       je.created_at
FROM journal_entries je
WHERE je.entry_no IN ('JE-0017', 'JV-000202')
ORDER BY je.entry_no;

-- 2) JE lines + liquidity account flags
SELECT je.entry_no,
       je.reference_type,
       je.payment_id,
       je.branch_id AS je_branch_id,
       a.code,
       a.name,
       a.type,
       jel.debit,
       jel.credit,
       CASE
         WHEN a.code IN ('1000', '1010', '1020') THEN true
         WHEN lower(COALESCE(a.type, '')) IN ('cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos') THEN true
         WHEN lower(COALESCE(a.name, '')) ~ 'cash|bank|wallet|jazz|easypaisa|ndm|mobicash|finja|upaisa|sadapay|nayapay' THEN true
         ELSE false
       END AS is_liquidity_account
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.entry_no IN ('JE-0017', 'JV-000202')
ORDER BY je.entry_no, jel.debit DESC;

-- 3) Payments linked via payment_id
SELECT je.entry_no,
       p.id AS payment_id,
       p.reference_number,
       p.payment_type,
       p.reference_type,
       p.reference_id,
       p.amount,
       p.payment_method,
       p.branch_id AS payment_branch_id,
       p.payment_account_id,
       a.name AS account_name,
       p.voided_at
FROM journal_entries je
JOIN payments p ON p.id = je.payment_id
LEFT JOIN accounts a ON a.id = p.payment_account_id
WHERE je.entry_no IN ('JE-0017', 'JV-000202');

-- 4) Payments linked via reference_id = je.id (manual_receipt / manual_payment)
SELECT je.entry_no,
       p.id AS payment_id,
       p.reference_number,
       p.payment_type,
       p.reference_type,
       p.reference_id,
       p.amount,
       p.branch_id AS payment_branch_id,
       p.voided_at
FROM journal_entries je
JOIN payments p
  ON p.reference_id::text = je.id::text
 AND lower(COALESCE(p.reference_type, '')) IN ('manual_receipt', 'manual_payment')
WHERE je.entry_no IN ('JE-0017', 'JV-000202');

-- 5) State summary (A=no payment, B=null branch, C=linked ok)
SELECT je.entry_no,
       je.branch_id AS je_branch_id,
       je.payment_id,
       EXISTS (
         SELECT 1 FROM payments p
         WHERE p.reference_id::text = je.id::text
           AND lower(COALESCE(p.reference_type, '')) IN ('manual_receipt', 'manual_payment')
           AND p.voided_at IS NULL
       ) AS has_manual_payment_row,
       (
         SELECT p.branch_id FROM payments p
         WHERE (p.id = je.payment_id OR p.reference_id::text = je.id::text)
           AND p.voided_at IS NULL
         LIMIT 1
       ) AS payment_branch_id
FROM journal_entries je
WHERE je.entry_no IN ('JE-0017', 'JV-000202');
