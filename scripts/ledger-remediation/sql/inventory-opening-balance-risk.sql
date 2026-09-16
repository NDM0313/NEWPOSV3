-- Opening balance JEs with NULL branch_id (info metric — report only)
SELECT
  je.company_id,
  c.name AS company_name,
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.branch_id,
  je.description
FROM journal_entries je
INNER JOIN companies c ON c.id = je.company_id
WHERE COALESCE(je.is_void, FALSE) = FALSE
  AND je.branch_id IS NULL
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) LIKE 'opening_balance%'
  AND ($1::uuid IS NULL OR je.company_id = $1::uuid)
ORDER BY c.name, je.entry_date NULLS LAST, je.entry_no;
