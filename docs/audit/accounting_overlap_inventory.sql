-- ============================================================================
-- ACCOUNTING OVERLAP INVENTORY (READ-ONLY)
-- List accounting-related tables, row counts, and overlap hints
-- Company-scoped where applicable. No DELETE/DROP/TRUNCATE.
-- ============================================================================

-- 1a) Core tables row counts – accounts, journal_entries, journal_entry_lines, payments, worker_ledger_entries
SELECT
  'accounts' AS tbl,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5') AS company_rows
FROM accounts
UNION ALL
SELECT 'journal_entries', COUNT(*), COUNT(*) FILTER (WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5') FROM journal_entries
UNION ALL
SELECT 'journal_entry_lines', COUNT(*), COUNT(*) FILTER (WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5')) FROM journal_entry_lines
UNION ALL
SELECT 'payments', COUNT(*), COUNT(*) FILTER (WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5') FROM payments
UNION ALL
SELECT 'worker_ledger_entries', COUNT(*), COUNT(*) FILTER (WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5') FROM worker_ledger_entries;

-- 1b) Ledger master/entries (may not exist in all deploys)
SELECT
  'ledger_master' AS tbl,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5') AS company_rows
FROM ledger_master
UNION ALL
SELECT 'ledger_entries', (SELECT COUNT(*) FROM ledger_entries), (SELECT COUNT(*) FROM ledger_entries le JOIN ledger_master lm ON lm.id = le.ledger_id WHERE lm.company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5');

-- 2) Legacy/alternate tables (if they exist)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('chart_accounts', 'account_transactions', 'worker_payments', 'document_sequences', 'document_sequences_global', 'erp_document_sequences')
  LOOP
    RAISE NOTICE 'Table exists: %', r.table_name;
  END LOOP;
END $$;

-- 3a) Numbering: erp_document_sequences
SELECT
  'erp_document_sequences' AS tbl,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5') AS company_rows
FROM erp_document_sequences;

-- 3b) Numbering: document_sequences_global (may not exist)
SELECT
  'document_sequences_global' AS tbl,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5') AS company_rows
FROM document_sequences_global;

-- 3c) Numbering: document_sequences (legacy, may not exist)
SELECT
  'document_sequences' AS tbl,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5') AS company_rows
FROM document_sequences;

-- 4) Views (courier_ledger, courier_summary, shipment_ledger – from COURIER_ACCOUNTING_SYSTEM.md)
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('courier_ledger', 'courier_summary', 'shipment_ledger', 'sales_with_shipping')
ORDER BY table_name;

-- 5) Journal entry reference_type breakdown (company)
SELECT
  reference_type,
  COUNT(*) AS cnt
FROM journal_entries
WHERE company_id = 'eb71d817-b87e-4195-964b-7b5321b480f5'
GROUP BY reference_type
ORDER BY cnt DESC;
