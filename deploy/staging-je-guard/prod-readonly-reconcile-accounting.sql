-- Production READ-ONLY reconciliation + Ibrahim accounting invariants.
-- Never UPDATE/INSERT/DELETE/DDL.

\echo '=== DB ==='
SELECT current_database() AS db, current_database() = 'postgres' AS is_live;

\echo '=== Guard catalog vs expected ==='
SELECT
  to_regprocedure('public.resolve_journal_posting_account_id(uuid,uuid)') IS NOT NULL AS has_resolve,
  to_regprocedure('public._journal_account_guard_resolve_public_core(uuid,uuid)') IS NOT NULL AS has_public_core,
  to_regprocedure('public.repair_restore_journal_entry_line_account(uuid,uuid,uuid,uuid,numeric,numeric,uuid)') IS NOT NULL AS has_repair,
  to_regclass('public.journal_account_verified_remaps') IS NOT NULL AS has_remaps,
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='journal_entry_lines'
      AND t.tgname='trg_guard_journal_entry_line_account' AND NOT t.tgisinternal
  ) AS has_guard_trigger;

\echo '=== ACL ==='
SELECT p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
  'resolve_journal_posting_account_id',
  '_journal_account_guard_resolve_public_core',
  'repair_restore_journal_entry_line_account'
)
ORDER BY 1;

\echo '=== Ibrahim live lines ==='
SELECT jel.id, je.entry_no, je.is_void, jel.debit, jel.credit,
       a.code, a.id AS account_id, c.code AS contact_code, c.name AS contact_name,
       je.company_id
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id=jel.journal_entry_id
JOIN accounts a ON a.id=jel.account_id
LEFT JOIN contacts c ON c.id=a.linked_contact_id
WHERE jel.id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
ORDER BY je.entry_no;

\echo '=== JE balance JE-0137 / JE-0138 ==='
SELECT je.entry_no,
       SUM(jel.debit) AS total_debit,
       SUM(jel.credit) AS total_credit,
       ROUND(SUM(jel.debit)-SUM(jel.credit),2) AS imbalance,
       COUNT(*) AS line_count
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
WHERE je.id IN (
  '9ff212f9-00b0-4239-8be4-b42cb0c8ec72',
  'db8436ec-bc0d-464c-8507-4baf81c99efa'
)
GROUP BY je.entry_no
ORDER BY 1;

\echo '=== Backup meta (must remain original run_id) ==='
SELECT run_id, scope, id_lace_status, expected_line_count, created_at, company_id
FROM backup_coa_limited_ibrahim_v1.meta;

\echo '=== Backup counts + pre/post account codes ==='
SELECT
  (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_v1.manifest) AS manifest_n,
  (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_v1.pre_apply_lines) AS pre_n,
  (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_v1.post_apply_lines) AS post_n;

SELECT 'pre' AS which, p.id, a.code, p.debit, p.credit
FROM backup_coa_limited_ibrahim_v1.pre_apply_lines p
JOIN accounts a ON a.id=p.account_id
UNION ALL
SELECT 'post', p.id, a.code, p.debit, p.credit
FROM backup_coa_limited_ibrahim_v1.post_apply_lines p
JOIN accounts a ON a.id=p.account_id
ORDER BY 1,2;

\echo '=== Live matches post_apply; amounts unchanged vs pre ==='
SELECT jel.id,
       jel.account_id = post.account_id AS matches_post_account,
       round(jel.debit,2)=round(pre.debit,2) AND round(jel.credit,2)=round(pre.credit,2) AS amounts_match_pre,
       round(jel.debit,2)=round(post.debit,2) AND round(jel.credit,2)=round(post.credit,2) AS amounts_match_post,
       jel.journal_entry_id = pre.journal_entry_id AS same_je
FROM journal_entry_lines jel
JOIN backup_coa_limited_ibrahim_v1.pre_apply_lines pre ON pre.id=jel.id
JOIN backup_coa_limited_ibrahim_v1.post_apply_lines post ON post.id=jel.id;

\echo '=== AP delta context (IBRAHIM 2 lines on AP) ==='
SELECT
  (SELECT ROUND(SUM(debit-credit),2) FROM journal_entry_lines WHERE account_id='3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c') AS legacy_210026_net,
  (SELECT ROUND(SUM(debit),2) FROM journal_entry_lines WHERE id IN (
     '677c74de-b677-4a6f-877f-b13e0ac66aaa','343c2586-2d86-4c24-9e03-3af493dada9d')) AS ibrahim_repaired_debit_sum,
  (SELECT COUNT(*) FROM journal_entry_lines WHERE id IN (
     '677c74de-b677-4a6f-877f-b13e0ac66aaa','343c2586-2d86-4c24-9e03-3af493dada9d')) AS ibrahim_line_count;

\echo '=== Held fingerprint (DHL/KIRAN/SHAHMIM/ID LACE) ==='
SELECT c.code AS contact_code, c.name, a.code AS account_code, COUNT(jel.id) AS lines
FROM contacts c
JOIN accounts a ON a.linked_contact_id=c.id
LEFT JOIN journal_entry_lines jel ON jel.account_id=a.id
WHERE c.name IN ('DHL','KIRAN MUKESH','SHAHMIM NAZ','ID LACE')
   OR c.code IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046','SUP-ZHD-0027','SUP-0013')
GROUP BY c.code, c.name, a.code
ORDER BY c.name, a.code;

SELECT md5(string_agg(jel.id::text || ':' || jel.account_id::text, ',' ORDER BY jel.id)) AS held_fp
FROM journal_entry_lines jel
JOIN accounts a ON a.id=jel.account_id
JOIN contacts c ON c.id=a.linked_contact_id
WHERE c.name IN ('DHL','KIRAN MUKESH','SHAHMIM NAZ','ID LACE')
   OR c.code IN ('SUP-ZHD-0007','SUP-ZHD-0036','SUP-ZHD-0046','SUP-ZHD-0027','SUP-0013');

\echo '=== ID LACE status ==='
SELECT 'ID_LACE_NOT_IMPLEMENTED' AS status,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname ILIKE '%id_lace%') AS has_id_lace_fn,
  (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_v1.manifest) AS ibrahim_manifest_only;

\echo '=== Company trial balance imbalance sample (posted non-void) ==='
SELECT ROUND(SUM(jel.debit)-SUM(jel.credit),2) AS company_gl_imbalance
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id=jel.journal_entry_id
WHERE je.company_id='e08a04af-22a8-4869-9b4d-da31fce13158'
  AND COALESCE(je.is_void,false)=false;
