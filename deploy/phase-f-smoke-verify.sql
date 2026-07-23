-- Phase F smoke test read-only verification (no mutations)
SELECT name FROM schema_migrations
WHERE name IN (
  '20260606120000_developer_repair_audit.sql',
  '20260606130000_developer_repair_relink_payment_je.sql'
)
ORDER BY name;

SELECT proname FROM pg_proc WHERE proname = 'developer_repair_relink_payment_je';

SELECT COUNT(*) AS audit_row_count FROM developer_repair_audit;

SELECT id, action_id, status, target_table, target_id, created_at
FROM developer_repair_audit
ORDER BY created_at DESC
LIMIT 15;
