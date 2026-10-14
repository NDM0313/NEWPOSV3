UPDATE feature_flags
SET enabled = false, updated_at = now()
WHERE company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
  AND feature_key = 'unified_ledger_screen_account_statement';
