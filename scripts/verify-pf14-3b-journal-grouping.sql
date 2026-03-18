-- PF-14.3B Journal Entry Presentation – Grouping Verification
-- Ensures: one logical sale = one root; sale + sale_adjustment + payment_adjustment link to same sale_id.
-- No DB schema change; grouping is presentation-only (root_reference_* computed in app).

-- 1) Sales with multiple JEs (original + adjustments): same reference_id = sale_id
SELECT reference_id AS sale_id, reference_type, COUNT(*) AS je_count
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND reference_type IN ('sale', 'sale_adjustment')
  AND reference_id IS NOT NULL
GROUP BY reference_id, reference_type
ORDER BY reference_id, reference_type;

-- 2) Payment adjustments: payment_id -> payments.reference_id = sale_id (root for grouping)
SELECT je.id, je.entry_no, je.reference_type, je.reference_id AS payment_id,
       p.reference_type AS pay_ref_type, p.reference_id AS sale_id
FROM journal_entries je
LEFT JOIN payments p ON p.id = je.reference_id AND je.reference_type = 'payment_adjustment'
WHERE je.reference_type = 'payment_adjustment'
LIMIT 20;

-- 3) No destructive overwrite: all JEs preserved (sample counts by type)
SELECT reference_type, COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
GROUP BY reference_type
ORDER BY reference_type;

-- 4) One logical sale row in UI = one group key (sale_id). This query lists sale_ids that have >1 JE (grouped in app).
SELECT reference_id AS sale_id, COUNT(*) AS total_jes
FROM journal_entries
WHERE company_id = (SELECT id FROM companies LIMIT 1)
  AND reference_type IN ('sale', 'sale_adjustment')
  AND reference_id IS NOT NULL
GROUP BY reference_id
HAVING COUNT(*) > 1
ORDER BY total_jes DESC
LIMIT 15;
