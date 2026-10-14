UPDATE feature_flags SET enabled = false, updated_at = now()
WHERE company_id = '597a5292-14c8-4cd8-96bd-c61b5a0d8c92' AND feature_key = 'unified_ledger_loader_ledger_v2';
