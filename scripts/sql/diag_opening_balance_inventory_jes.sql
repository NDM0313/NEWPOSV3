\set company_id '30bd8592-3384-4f34-899a-f3907e336485'

SELECT '=== opening_balance_inventory JEs vs movements ===' AS section;
SELECT
  je.id,
  je.entry_no,
  je.reference_id AS movement_id,
  EXISTS(SELECT 1 FROM stock_movements sm WHERE sm.id = je.reference_id) AS movement_exists,
  ROUND(COALESCE(je.total_debit, 0)::numeric, 2) AS je_amount,
  je.is_void
FROM journal_entries je
WHERE je.company_id = :'company_id'::uuid
  AND je.reference_type = 'opening_balance_inventory'
ORDER BY je.entry_date;
