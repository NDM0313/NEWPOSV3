-- PF-14 Sale Edit Accounting Integrity / Immutable JE Number / Delta Adjustments
-- Run in Supabase SQL Editor. Use your company_id or leave as variable.
-- Checks: original sale JEs unchanged, adjustment JEs exist, no duplicate sale JEs, trial balance, AR/AP codes.

-- 1) Journal entries by reference_type (sale vs sale_adjustment) – counts
SELECT
  reference_type,
  COUNT(*) AS je_count,
  COUNT(DISTINCT reference_id) AS distinct_sale_ids
FROM journal_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND reference_type IN ('sale', 'sale_adjustment')
GROUP BY reference_type;

-- 2) No duplicate original sale JEs per sale_id (each sale at most one JE with reference_type = 'sale')
SELECT 'SALE_JE_DUPLICATES' AS check_name,
  COALESCE(SUM(cnt - 1), 0)::text AS extra_count
FROM (
  SELECT reference_id, COUNT(*) AS cnt
  FROM journal_entries
  WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
    AND reference_type = 'sale'
    AND reference_id IS NOT NULL
  GROUP BY reference_id
  HAVING COUNT(*) > 1
) t;

-- 3) Trial balance (all JE lines) – must be 0
SELECT 'TB_DIFF' AS check_name,
  (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))::numeric(15,2)::text AS val
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5';

-- 4) Canonical account codes: 1100 = Accounts Receivable, 2000 = Accounts Payable
SELECT id, code, name
FROM accounts
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND code IN ('1100', '2000')
ORDER BY code;

-- 5) Sample: sale + its adjustment JEs (one sale that has adjustments)
SELECT je.entry_no, je.reference_type, je.reference_id, je.entry_date, je.description
FROM journal_entries je
WHERE je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
  AND je.reference_type IN ('sale', 'sale_adjustment')
  AND je.reference_id IN (
    SELECT reference_id FROM journal_entries
    WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND reference_type = 'sale_adjustment' LIMIT 1
  )
ORDER BY je.entry_date, je.created_at;

-- 6) Entry_no present and immutable (no update to entry_no on journal_entries)
-- (Manual check: no trigger or app code should UPDATE journal_entries.entry_no for existing rows)
