-- PF-13 Posted Document Edit Sync / Repost Integrity
-- Run on VPS: docker exec -i supabase-db psql -U postgres -d postgres -f - < scripts/verify-pf13-repost-integrity.sql
-- NEW BUSINESS: c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee  OLD BUSINESS: eb71d817-b87e-4195-964b-7b5321b480f5

-- 1) No duplicate sale JEs per sale_id (each sale should have at most one JE with reference_type='sale')
SELECT 'SALE_JE_DUPLICATES_NEW' AS check_name, COALESCE(SUM(cnt - 1), 0)::text AS val
FROM (SELECT reference_id, COUNT(*) AS cnt FROM journal_entries WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee' AND reference_type = 'sale' AND reference_id IS NOT NULL GROUP BY reference_id HAVING COUNT(*) > 1) t;

SELECT 'SALE_JE_DUPLICATES_OLD' AS check_name, COALESCE(SUM(cnt - 1), 0)::text AS val
FROM (SELECT reference_id, COUNT(*) AS cnt FROM journal_entries WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND reference_type = 'sale' AND reference_id IS NOT NULL GROUP BY reference_id HAVING COUNT(*) > 1) t;

-- 2) No duplicate purchase JEs per purchase_id
SELECT 'PURCHASE_JE_DUPLICATES_NEW' AS check_name, COALESCE(SUM(cnt - 1), 0)::text AS val
FROM (SELECT reference_id, COUNT(*) AS cnt FROM journal_entries WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee' AND reference_type = 'purchase' AND reference_id IS NOT NULL GROUP BY reference_id HAVING COUNT(*) > 1) t;

SELECT 'PURCHASE_JE_DUPLICATES_OLD' AS check_name, COALESCE(SUM(cnt - 1), 0)::text AS val
FROM (SELECT reference_id, COUNT(*) AS cnt FROM journal_entries WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5' AND reference_type = 'purchase' AND reference_id IS NOT NULL GROUP BY reference_id HAVING COUNT(*) > 1) t;

-- 3) Trial balance (JE lines) balance check
SELECT 'TB_DIFF_NEW' AS check_name, (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))::numeric(15,2)::text AS val
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee';

SELECT 'TB_DIFF_OLD' AS check_name, (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))::numeric(15,2)::text AS val
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5';

-- 4) Count sale JEs and purchase JEs for NEW
SELECT 'SALE_JE_COUNT_NEW' AS check_name, COUNT(*)::text AS val FROM journal_entries WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee' AND reference_type = 'sale';
SELECT 'PURCHASE_JE_COUNT_NEW' AS check_name, COUNT(*)::text AS val FROM journal_entries WHERE company_id = 'c37b77cc-6eb9-4fc0-af7d-3e1eaaeaeaee' AND reference_type = 'purchase';
