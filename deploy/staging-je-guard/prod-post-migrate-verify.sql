-- Post-migration catalog / ACL / remap verification (SELECT + privilege checks only)
\set ON_ERROR_STOP on

\echo '=== DB identity ==='
SELECT current_database() AS db, current_database() = 'postgres' AS is_live_postgres;

\echo '=== Objects / triggers ==='
SELECT
  to_regclass('public.journal_account_verified_remaps') IS NOT NULL AS has_remaps,
  to_regclass('public.journal_account_guard_events') IS NOT NULL AS has_events,
  to_regclass('public._journal_account_repair_tickets') IS NOT NULL AS has_tickets,
  to_regprocedure('public.resolve_journal_posting_account_id(uuid,uuid)') IS NOT NULL AS has_resolve,
  to_regprocedure('public._journal_account_guard_resolve_public_core(uuid,uuid)') IS NOT NULL AS has_public_core,
  to_regprocedure('public.repair_restore_journal_entry_line_account(uuid,uuid,uuid,uuid,numeric,numeric,uuid)') IS NOT NULL AS has_repair_entry,
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='journal_entry_lines'
      AND t.tgname='trg_guard_journal_entry_line_account' AND NOT t.tgisinternal AND t.tgenabled <> 'D'
  ) AS trg_line_guard_enabled,
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='accounts'
      AND t.tgname='trg_accounts_reject_company_reassign_with_lines' AND t.tgenabled <> 'D'
  ) AS trg_accounts_company,
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='journal_entries'
      AND t.tgname='trg_journal_entries_reject_company_reassign' AND t.tgenabled <> 'D'
  ) AS trg_je_company;

\echo '=== ACL matrix ==='
SELECT
  has_function_privilege('authenticated','public.resolve_journal_posting_account_id(uuid,uuid)','EXECUTE') AS auth_resolve,
  has_function_privilege('authenticated','public._journal_account_guard_resolve_public_core(uuid,uuid)','EXECUTE') AS auth_public_core,
  has_function_privilege('authenticated','public.repair_restore_journal_entry_line_account(uuid,uuid,uuid,uuid,numeric,numeric,uuid)','EXECUTE') AS auth_repair,
  has_function_privilege('anon','public.resolve_journal_posting_account_id(uuid,uuid)','EXECUTE') AS anon_resolve,
  has_function_privilege('anon','public._journal_account_guard_resolve_public_core(uuid,uuid)','EXECUTE') AS anon_public_core,
  has_function_privilege('anon','public.repair_restore_journal_entry_line_account(uuid,uuid,uuid,uuid,numeric,numeric,uuid)','EXECUTE') AS anon_repair,
  has_function_privilege('service_role','public.repair_restore_journal_entry_line_account(uuid,uuid,uuid,uuid,numeric,numeric,uuid)','EXECUTE') AS svc_repair,
  has_table_privilege('authenticated','public._journal_account_repair_tickets','INSERT') AS auth_tickets_insert;

SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    '_journal_account_guard_resolve_core',
    '_journal_account_guard_resolve_internal',
    '_repair_restore_journal_entry_line_account_internal'
  )
ORDER BY p.proname;

\echo '=== Remap counts + IBRAHIM pair ==='
SELECT COUNT(*) AS remap_total,
       COUNT(*) FILTER (WHERE source = 'backup_coa_merge_20260916.merge_pairs') AS from_merge_pairs
FROM journal_account_verified_remaps
WHERE company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158';

SELECT r.company_id, r.from_account_id, r.to_account_id, r.from_code, r.to_code,
       r.expected_contact_id, r.source,
       c.code AS contact_code, c.name AS contact_name
FROM journal_account_verified_remaps r
LEFT JOIN contacts c ON c.id = r.expected_contact_id
WHERE r.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
  AND r.from_account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'
  AND r.to_account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312';

\echo '=== IBRAHIM lines NOT modified (still on legacy 210026) ==='
SELECT jel.id AS line_id, je.entry_no, jel.account_id, a.code, jel.debit, jel.credit, je.is_void
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE jel.id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
ORDER BY je.entry_no;

\echo '=== backup_coa_limited_ibrahim_v1 still ABSENT ==='
SELECT
  to_regnamespace('backup_coa_limited_ibrahim_v1') IS NOT NULL AS has_backup_ns,
  to_regclass('backup_coa_limited_ibrahim_v1.meta') IS NOT NULL AS has_meta,
  to_regclass('backup_coa_limited_ibrahim_v1.manifest') IS NOT NULL AS has_manifest;
