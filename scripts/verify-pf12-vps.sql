-- PF-12 DB smoke checks (run on VPS: docker exec -i supabase-db psql -U postgres -d postgres -f - < scripts/verify-pf12-vps.sql)
-- NEW BUSINESS: c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee  OLD BUSINESS: eb71d817-b87e-4195-964b-7b5321b480f5

SELECT 'VIEW_EXISTS' AS check_name, COUNT(*)::text AS val FROM information_schema.views WHERE table_name = 'shipment_ledger';

SELECT 'NEW_COMPANY' AS check_name, COUNT(*)::text AS val FROM companies WHERE id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';

SELECT 'OLD_COMPANY' AS check_name, COUNT(*)::text AS val FROM companies WHERE id = 'eb71d817-b87e-4195-964b-7b5321b480f5';

SELECT 'NEW_ACCOUNTS' AS check_name, COUNT(*)::text AS val FROM accounts WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee' AND is_active = true;

SELECT 'OLD_ACCOUNTS' AS check_name, COUNT(*)::text AS val FROM accounts WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND is_active = true;

SELECT 'SHIPMENT_LEDGER_READ' AS check_name, COUNT(*)::text AS val FROM shipment_ledger;

SELECT 'TB_NEW_OK' AS check_name, (SELECT (ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) < 0.02)::text FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee') AS val;

SELECT 'TB_OLD_OK' AS check_name, (SELECT (ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) < 0.02)::text FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5') AS val;
