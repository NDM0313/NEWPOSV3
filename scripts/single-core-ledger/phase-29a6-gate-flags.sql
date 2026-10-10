-- Phase 2.9A-6 Gate 4 — read-only DIN CHINA unified_ledger flags (production supabase-db)
SELECT feature_key, enabled, updated_at
FROM feature_flags
WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND feature_key LIKE 'unified_ledger%'
ORDER BY feature_key;
