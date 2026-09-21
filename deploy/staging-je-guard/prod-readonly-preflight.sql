-- PRODUCTION READ-ONLY preflight for JE guard gate. SELECT / catalog only.
-- Target: live database name postgres. Never UPDATE/DELETE/CREATE.

\echo '=== DB identity ==='
SELECT current_database() AS db, current_database() = 'postgres' AS is_live_postgres;

\echo '=== Guard objects (expect ABSENT on production) ==='
SELECT
  to_regprocedure('public.resolve_journal_posting_account_id(uuid,uuid)') IS NOT NULL AS has_resolve,
  to_regprocedure('public._journal_account_guard_resolve_public_core(uuid,uuid)') IS NOT NULL AS has_public_core,
  to_regclass('public.journal_account_verified_remaps') IS NOT NULL AS has_remaps,
  to_regclass('public.journal_account_guard_events') IS NOT NULL AS has_events,
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='journal_entry_lines'
      AND t.tgname='trg_guard_journal_entry_line_account'
  ) AS has_guard_trigger;

\echo '=== IBRAHIM exact scope ==='
SELECT jel.id AS line_id, je.entry_no, je.is_void, jel.debit, jel.credit,
       a.id AS account_id, a.code, a.is_active, a.linked_contact_id,
       c.name AS contact_name, c.code AS contact_code
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
LEFT JOIN contacts c ON c.id = a.linked_contact_id
WHERE jel.id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
ORDER BY je.entry_no;

\echo '=== Legacy 210026 / AP-SUPZHD0026 accounts ==='
SELECT id, code, is_active, linked_contact_id, company_id
FROM accounts
WHERE id IN (
  '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c',
  '2c56a1d1-e31d-433f-85af-ce3fd4729312'
)
ORDER BY code;

\echo '=== JE-0137 / JE-0138 headers ==='
SELECT id, entry_no, entry_date, company_id, is_void
FROM journal_entries
WHERE entry_no IN ('JE-0137','JE-0138')
  AND company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
ORDER BY entry_no;

\echo '=== merge_pairs presence + IBRAHIM eligibility ==='
SELECT to_regnamespace('backup_coa_merge_20260916') IS NOT NULL AS has_backup_schema,
       to_regclass('backup_coa_merge_20260916.merge_pairs') IS NOT NULL AS has_merge_pairs;

SELECT mp.*
FROM backup_coa_merge_20260916.merge_pairs mp
WHERE mp.legacy_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'
   OR mp.ap_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312'
   OR COALESCE(mp.legacy_code,'') IN ('210026')
   OR COALESCE(mp.ap_code,'') IN ('AP-SUPZHD0026')
   OR COALESCE(mp.contact_code,'') ILIKE '%IBRAHIM%';

\echo '=== BACKUP_EXISTS check (backup_coa_limited_ibrahim_v1) ==='
SELECT
  to_regnamespace('backup_coa_limited_ibrahim_v1') IS NOT NULL AS has_backup_ns,
  to_regclass('backup_coa_limited_ibrahim_v1.meta') IS NOT NULL AS has_meta,
  to_regclass('backup_coa_limited_ibrahim_v1.manifest') IS NOT NULL AS has_manifest,
  to_regclass('backup_coa_limited_ibrahim_v1.pre_apply_lines') IS NOT NULL AS has_pre,
  to_regclass('backup_coa_limited_ibrahim_v1.post_apply_lines') IS NOT NULL AS has_post;

\echo '=== ID LACE out of scope note ==='
SELECT 'ID_LACE_NOT_IMPLEMENTED' AS status,
       COUNT(*) FILTER (WHERE a.id='e11d244a-b96e-4128-8ca3-2bae5a4f813c') AS legacy_210027_rows,
       COUNT(*) FILTER (WHERE a.id='30bbe521-5773-4985-8be1-0d336c56a6a3') AS ap_supzhd0027_rows
FROM accounts a
WHERE a.id IN (
  'e11d244a-b96e-4128-8ca3-2bae5a4f813c',
  '30bbe521-5773-4985-8be1-0d336c56a6a3'
);
