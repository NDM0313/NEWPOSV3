-- Phase 2.10C — cross-company guard for unified_ledger_loader_ledger_v2

SELECT company_id, feature_key, enabled, updated_at
FROM feature_flags
WHERE feature_key = 'unified_ledger_loader_ledger_v2'
ORDER BY company_id, feature_key;
