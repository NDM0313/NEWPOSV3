-- DIN COUTURE DIN COUTURE monitoring — pipe-friendly flag export
SELECT company_id::text, feature_key, enabled::text
FROM feature_flags
WHERE feature_key LIKE 'unified_ledger%'
ORDER BY company_id, feature_key;

