-- audit company e08a04af-22a8-4869-9b4d-da31fce13158
\pset pager off

SELECT 'company' AS section, name, id::text FROM companies WHERE id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid;

WITH ar_accounts AS (
  SELECT a.id FROM accounts a
  WHERE a.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
    AND (
      a.code LIKE '1100%'
      OR lower(coalesce(a.name, '')) LIKE '%receivable%'
      OR a.linked_contact_id IS NOT NULL
    )
)
SELECT
  'ref_mix' AS section,
  coalesce(nullif(trim(je.reference_type), ''), '(null)') AS reference_type,
  count(*) AS line_count,
  round(sum(coalesce(jel.debit, 0))::numeric, 2) AS total_debit,
  round(sum(coalesce(jel.credit, 0))::numeric, 2) AS total_credit
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN ar_accounts aa ON aa.id = jel.account_id
WHERE je.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
  AND coalesce(je.is_void, false) = false
GROUP BY 1, 2
ORDER BY line_count DESC;

SELECT
  'linked_contacts' AS section,
  c.id::text AS contact_id,
  c.name AS contact_name,
  a.id::text AS ar_account_id,
  a.code AS ar_code,
  a.name AS ar_name,
  (
    SELECT count(*)
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = a.id
      AND je.company_id = c.company_id
      AND coalesce(je.is_void, false) = false
  ) AS ar_line_count,
  (
    SELECT count(*)
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = a.id
      AND je.company_id = c.company_id
      AND coalesce(je.is_void, false) = false
      AND lower(coalesce(je.reference_type, '')) IN (
        'sale', 'sale_adjustment', 'sale_reversal', 'sale_return',
        'payment', 'manual_receipt', 'opening_balance_contact_ar',
        'rental', 'party_discount'
      )
  ) AS party_safe_line_count
FROM contacts c
JOIN accounts a ON a.linked_contact_id = c.id AND a.company_id = c.company_id
WHERE c.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
ORDER BY ar_line_count DESC
LIMIT 50;
