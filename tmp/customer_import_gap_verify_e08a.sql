\pset pager off

-- Re-check linked contacts party-safe after repair
SELECT
  c.name AS contact_name,
  a.code AS ar_code,
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
        'opening_balance_contact_ap', 'rental', 'party_discount'
      )
      AND (
        je.reference_id IS NULL
        OR je.reference_id = c.id
      )
  ) AS party_safe_line_count
FROM contacts c
JOIN accounts a ON a.linked_contact_id = c.id AND a.company_id = c.company_id
WHERE c.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
ORDER BY ar_line_count DESC
LIMIT 15;

-- Remaining orphans (multi-contact still skipped)
WITH party_accounts AS (
  SELECT a.id, a.linked_contact_id
  FROM accounts a
  WHERE a.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
    AND a.linked_contact_id IS NOT NULL
)
SELECT count(DISTINCT je.id) AS remaining_non_party_safe_jes
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN party_accounts pa ON pa.id = jel.account_id
WHERE je.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
  AND coalesce(je.is_void, false) = false
  AND lower(coalesce(je.reference_type, '')) NOT IN (
    'sale', 'sale_adjustment', 'sale_reversal', 'sale_return',
    'payment', 'manual_receipt', 'opening_balance_contact_ar',
    'opening_balance_contact_ap', 'opening_balance_contact_worker',
    'rental', 'party_discount',
    'purchase', 'purchase_adjustment', 'purchase_return', 'correction_reversal'
  );

-- Header integrity: opening_ar must match linked contact of AR lines
SELECT count(*) AS mismatched_ar_headers
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
  AND je.reference_type = 'opening_balance_contact_ar'
  AND a.linked_contact_id IS NOT NULL
  AND a.linked_contact_id IS DISTINCT FROM je.reference_id;
