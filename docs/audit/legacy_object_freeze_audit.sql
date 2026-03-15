-- ============================================================================
-- Legacy Object Freeze Audit (Phase 4)
-- Company: eb71d817-b87e-4195-964b-7b5321b480f5
-- Lists accounting-related tables/views and their legacy status.
-- Use to verify no new posting paths write to legacy objects.
-- ============================================================================

-- 1) Tables that exist and their pg_catalog comment (if set)
SELECT
  c.relname AS table_name,
  CASE WHEN c.relkind = 'r' THEN 'table' WHEN c.relkind = 'v' THEN 'view' ELSE c.relkind::text END AS kind,
  COALESCE(pg_catalog.obj_description(c.oid, 'pg_class'), '') AS comment
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'v')
  AND c.relname IN (
    'document_sequences',
    'document_sequences_global',
    'chart_accounts',
    'account_transactions',
    'worker_payments',
    'accounts',
    'journal_entries',
    'journal_entry_lines',
    'payments',
    'worker_ledger_entries',
    'erp_document_sequences',
    'ledger_master',
    'ledger_entries'
  )
ORDER BY c.relname;

-- 2) Canonical vs legacy (summary)
-- Canonical for posting: accounts, journal_entries, journal_entry_lines, payments, worker_ledger_entries, erp_document_sequences
-- Legacy (do not use for new posting): document_sequences, document_sequences_global, chart_accounts, account_transactions, worker_payments
SELECT
  relname AS object_name,
  CASE
    WHEN relname IN ('accounts', 'journal_entries', 'journal_entry_lines', 'payments', 'worker_ledger_entries', 'erp_document_sequences') THEN 'CANONICAL'
    WHEN relname IN ('document_sequences', 'document_sequences_global', 'chart_accounts', 'account_transactions', 'worker_payments') THEN 'LEGACY_CANDIDATE'
    ELSE 'OTHER'
  END AS posting_status
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'document_sequences', 'document_sequences_global', 'chart_accounts', 'account_transactions',
    'worker_payments', 'accounts', 'journal_entries', 'journal_entry_lines', 'payments',
    'worker_ledger_entries', 'erp_document_sequences'
  )
ORDER BY posting_status, relname;
