-- Phase 2.11 L2 rollback — Account Statement screen OFF (DIN CHINA only)

UPDATE feature_flags
SET enabled = false, updated_at = now()
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key = 'unified_ledger_screen_account_statement';
