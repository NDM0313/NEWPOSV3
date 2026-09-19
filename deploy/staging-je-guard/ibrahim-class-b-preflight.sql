-- IBRAHIM Class B preflight (SELECT only) before 01/02
\set ON_ERROR_STOP on

SELECT current_database() AS db, current_database() = 'postgres' AS is_live;

SELECT
  to_regclass('public.journal_account_verified_remaps') IS NOT NULL AS has_remaps,
  to_regprocedure('public.repair_restore_journal_entry_line_account(uuid,uuid,uuid,uuid,numeric,numeric,uuid)') IS NOT NULL AS has_repair,
  EXISTS (
    SELECT 1 FROM journal_account_verified_remaps
    WHERE company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
      AND from_account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'
      AND to_account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312'
  ) AS ibrahim_remap,
  to_regnamespace('backup_coa_limited_ibrahim_v1') IS NOT NULL AS backup_ns_exists,
  to_regclass('backup_coa_limited_ibrahim_v1.meta') IS NOT NULL AS backup_meta_exists;

SELECT jel.id, je.entry_no, a.code, jel.account_id, jel.debit, jel.credit, je.is_void
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE jel.id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
ORDER BY je.entry_no;

SELECT 'ID_LACE_NOT_IMPLEMENTED' AS status;
