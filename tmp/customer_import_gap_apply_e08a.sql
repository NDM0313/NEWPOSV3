\pset pager off
\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE _din_party_accounts AS
SELECT a.id, a.code, a.name, a.linked_contact_id, c.name AS contact_name,
       CASE
         WHEN a.code LIKE '11%' OR lower(coalesce(a.name,'')) LIKE '%receivable%' THEN 'ar'
         WHEN a.code LIKE '21%' OR lower(coalesce(a.name,'')) LIKE '%payable%' THEN 'ap'
         ELSE 'other'
       END AS party_side
FROM accounts a
JOIN contacts c ON c.id = a.linked_contact_id AND c.company_id = a.company_id
WHERE a.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
  AND a.linked_contact_id IS NOT NULL;

CREATE TEMP TABLE _din_orphan_je AS
SELECT
  je.id AS je_id,
  count(DISTINCT pa.linked_contact_id) AS distinct_contacts,
  bool_or(pa.party_side = 'ar') AS has_ar,
  bool_or(pa.party_side = 'ap') AS has_ap,
  (array_agg(pa.linked_contact_id::text ORDER BY pa.linked_contact_id::text))[1] AS only_contact_id,
  (array_agg(pa.party_side ORDER BY pa.linked_contact_id::text))[1] AS only_side_hint
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN _din_party_accounts pa ON pa.id = jel.account_id
WHERE je.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
  AND coalesce(je.is_void, false) = false
  AND lower(coalesce(je.reference_type, '')) NOT IN (
    'sale', 'sale_adjustment', 'sale_reversal', 'sale_return',
    'payment', 'manual_receipt', 'opening_balance_contact_ar',
    'opening_balance_contact_ap', 'opening_balance_contact_worker',
    'rental', 'party_discount',
    'purchase', 'purchase_adjustment', 'purchase_return', 'correction_reversal'
  )
GROUP BY je.id;

CREATE TEMP TABLE _din_repair_targets AS
SELECT
  o.je_id,
  o.only_contact_id::uuid AS contact_id,
  CASE
    WHEN o.distinct_contacts = 1 AND o.has_ar AND NOT o.has_ap THEN 'opening_balance_contact_ar'
    WHEN o.distinct_contacts = 1 AND o.has_ap AND NOT o.has_ar THEN 'opening_balance_contact_ap'
    ELSE NULL
  END AS new_reference_type
FROM _din_orphan_je o
WHERE o.distinct_contacts = 1
  AND (
    (o.has_ar AND NOT o.has_ap) OR (o.has_ap AND NOT o.has_ar)
  );

-- Pre-counts
SELECT 'pre_targets' AS section,
  count(*) AS total_targets,
  count(*) FILTER (WHERE new_reference_type = 'opening_balance_contact_ar') AS ar_targets,
  count(*) FILTER (WHERE new_reference_type = 'opening_balance_contact_ap') AS ap_targets
FROM _din_repair_targets
WHERE new_reference_type IS NOT NULL;

SELECT 'pre_skipped_multi' AS section, count(*) AS multi_contact_jes
FROM _din_orphan_je WHERE distinct_contacts > 1;

UPDATE journal_entries je
SET
  reference_type = t.new_reference_type,
  reference_id = t.contact_id,
  updated_at = now()
FROM _din_repair_targets t
WHERE je.id = t.je_id
  AND je.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
  AND t.new_reference_type IS NOT NULL;

-- Verify updated headers
SELECT 'post_verify' AS section,
  je.reference_type,
  count(*) AS jes
FROM journal_entries je
JOIN _din_repair_targets t ON t.je_id = je.id
WHERE t.new_reference_type IS NOT NULL
GROUP BY je.reference_type
ORDER BY jes DESC;

-- Spot-check: SHOP A8 ZHD contact should now have party-safe JE refs on its AR leaf
SELECT 'shop_a8_check' AS section,
  (
    SELECT count(*)
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = 'd20b7dc5-032e-475e-84f0-2fffeeecb051'::uuid
      AND je.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'::uuid
      AND coalesce(je.is_void, false) = false
      AND lower(coalesce(je.reference_type, '')) = 'opening_balance_contact_ar'
      AND je.reference_id = '239cd129-cebb-40ee-893a-90ae3a5d29b0'::uuid
  ) AS opening_ar_jes_for_shop_a8;

COMMIT;
