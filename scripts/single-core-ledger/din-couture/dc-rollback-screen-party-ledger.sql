UPDATE feature_flags SET enabled = false, updated_at = now()
WHERE company_id = '2ab65903-62a3-4bcf-bced-076b681e9b74' AND feature_key = 'unified_ledger_screen_party_ledger';

