\pset pager off

-- DIN COLLECTION party-leaf orphan JE shape
WITH party_accounts AS (
  SELECT a.id, a.code, a.name, a.linked_contact_id, c.name AS contact_name,
         CASE
           WHEN a.code LIKE '11%' OR lower(coalesce(a.name,'')) LIKE '%receivable%' THEN 'ar'
           WHEN a.code LIKE '21%' OR lower(coalesce(a.name,'')) LIKE '%payable%' THEN 'ap'
           ELSE 'other'
         END AS party_side
  FROM accounts a
  JOIN contacts c ON c.id = a.linked_contact_id AND c.company_id = a.company_id
  WHERE a.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
    AND a.linked_contact_id IS NOT NULL
),
je_party AS (
  SELECT
    je.id AS je_id,
    je.entry_no,
    je.entry_date,
    je.reference_type,
    je.reference_id,
    count(DISTINCT pa.linked_contact_id) AS distinct_contacts,
    count(DISTINCT pa.party_side) AS distinct_sides,
    min(pa.linked_contact_id::text) AS only_contact_id,
    min(pa.party_side) AS only_side,
    min(pa.contact_name) AS only_contact_name,
    bool_or(pa.party_side = 'ar') AS has_ar,
    bool_or(pa.party_side = 'ap') AS has_ap
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN party_accounts pa ON pa.id = jel.account_id
  WHERE je.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
    AND coalesce(je.is_void, false) = false
    AND lower(coalesce(je.reference_type, '')) NOT IN (
      'sale', 'sale_adjustment', 'sale_reversal', 'sale_return',
      'payment', 'manual_receipt', 'opening_balance_contact_ar',
      'opening_balance_contact_ap', 'rental', 'party_discount',
      'purchase', 'purchase_adjustment', 'purchase_return', 'correction_reversal'
    )
  GROUP BY je.id, je.entry_no, je.entry_date, je.reference_type, je.reference_id
)
SELECT 'summary' AS section,
  count(*) AS orphan_jes,
  count(*) FILTER (WHERE distinct_contacts = 1 AND has_ar AND NOT has_ap) AS single_ar_only,
  count(*) FILTER (WHERE distinct_contacts = 1 AND has_ap AND NOT has_ar) AS single_ap_only,
  count(*) FILTER (WHERE distinct_contacts = 1 AND has_ar AND has_ap) AS single_contact_ar_and_ap,
  count(*) FILTER (WHERE distinct_contacts > 1) AS multi_contact,
  count(*) FILTER (WHERE distinct_contacts = 1 AND only_side = 'other') AS single_other
FROM je_party;

SELECT 'by_ref' AS section, coalesce(reference_type,'(null)') AS reference_type,
  count(*) AS jes,
  count(*) FILTER (WHERE distinct_contacts = 1 AND has_ar AND NOT has_ap) AS single_ar,
  count(*) FILTER (WHERE distinct_contacts = 1 AND has_ap AND NOT has_ar) AS single_ap,
  count(*) FILTER (WHERE distinct_contacts > 1) AS multi
FROM je_party
GROUP BY 1, 2
ORDER BY jes DESC;

-- sample single-AR candidates (top 20)
SELECT 'sample_ar' AS section, je_id::text, entry_no, entry_date::text, reference_type,
  only_contact_name, only_contact_id, only_side
FROM je_party
WHERE distinct_contacts = 1 AND has_ar AND NOT has_ap
ORDER BY entry_date
LIMIT 20;

-- sample single-AP candidates
SELECT 'sample_ap' AS section, je_id::text, entry_no, entry_date::text, reference_type,
  only_contact_name, only_contact_id, only_side
FROM je_party
WHERE distinct_contacts = 1 AND has_ap AND NOT has_ar
ORDER BY entry_date
LIMIT 20;

-- multi-contact problematic
SELECT 'sample_multi' AS section, je_id::text, entry_no, entry_date::text, reference_type, distinct_contacts
FROM je_party
WHERE distinct_contacts > 1
ORDER BY entry_date
LIMIT 10;
