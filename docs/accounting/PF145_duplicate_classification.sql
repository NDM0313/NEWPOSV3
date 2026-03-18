-- PF-14.5B: Duplicate and orphan classification (preview only).
-- Use (SELECT id FROM companies LIMIT 1) or replace with your company_id.

-- ========== 1. EXACT DUPLICATE CANDIDATES: sale_adjustment (same sale_id + same description) ==========
SELECT
  'sale_adjustment' AS reference_type,
  reference_id AS root_id,
  description,
  COUNT(*) AS cnt,
  array_agg(id ORDER BY created_at) AS je_ids,
  array_agg(entry_no ORDER BY created_at) AS entry_nos,
  MIN(created_at) AS earliest_at
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND reference_type = 'sale_adjustment'
  AND (is_void IS NOT TRUE)
GROUP BY reference_id, description
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ========== 2. EXACT DUPLICATE CANDIDATES: payment_adjustment (same payment_id + same description) ==========
SELECT
  'payment_adjustment' AS reference_type,
  reference_id AS payment_id,
  LEFT(description, 120) AS description_sample,
  COUNT(*) AS cnt,
  array_agg(id ORDER BY created_at) AS je_ids,
  MIN(created_at) AS earliest_at
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND reference_type = 'payment_adjustment'
  AND (is_void IS NOT TRUE)
GROUP BY reference_id, description
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ========== 3. PAYMENT ACCOUNT CHANGE DUPLICATES (same payment_id + "Payment account changed") ==========
-- Group by payment_id and line pattern (same old/new account + amount) to find duplicate transfer JEs
WITH pay_adj AS (
  SELECT je.id, je.entry_no, je.reference_id AS payment_id, je.description, je.created_at,
         (SELECT json_agg(json_build_object('account_id', jel.account_id, 'debit', jel.debit, 'credit', jel.credit) ORDER BY jel.account_id)
          FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id) AS line_sig
  FROM journal_entries je
  WHERE je.company_id = (SELECT id FROM companies LIMIT 1)
    AND je.reference_type = 'payment_adjustment'
    AND je.description ILIKE '%Payment account changed%'
    AND (je.is_void IS NOT TRUE)
)
SELECT payment_id, line_sig::text, COUNT(*) AS cnt, array_agg(id ORDER BY created_at) AS je_ids
FROM pay_adj
GROUP BY payment_id, line_sig
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ========== 4. ORPHAN: sale_adjustment where sale no longer exists ==========
SELECT je.id, je.entry_no, je.reference_id AS sale_id, je.description, je.created_at
FROM journal_entries je
LEFT JOIN sales s ON s.id = je.reference_id
WHERE je.company_id = (SELECT id FROM companies LIMIT 1)
  AND je.reference_type = 'sale_adjustment'
  AND je.reference_id IS NOT NULL
  AND s.id IS NULL
  AND (je.is_void IS NOT TRUE);

-- ========== 5. ORPHAN: payment_adjustment where payment no longer exists ==========
SELECT je.id, je.entry_no, je.reference_id AS payment_id, je.description, je.created_at
FROM journal_entries je
LEFT JOIN payments p ON p.id = je.reference_id
WHERE je.company_id = (SELECT id FROM companies LIMIT 1)
  AND je.reference_type = 'payment_adjustment'
  AND je.reference_id IS NOT NULL
  AND p.id IS NULL
  AND (je.is_void IS NOT TRUE);

-- ========== 6. VOIDED ENTRIES COUNT (audit) ==========
SELECT reference_type, COUNT(*) AS voided_count
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND is_void = true
GROUP BY reference_type
ORDER BY reference_type;

-- ========== 7. ACTIVE JEs BY TYPE (business view) ==========
SELECT reference_type, COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND (is_void IS NOT TRUE)
GROUP BY reference_type
ORDER BY reference_type;
