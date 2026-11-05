\set ON_ERROR_STOP on
SELECT current_database() AS db;
SELECT jel.id, je.entry_no, a.code, jel.account_id, jel.debit, jel.credit, je.is_void
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE jel.id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
ORDER BY je.entry_no;
SELECT company_id, run_id, scope, id_lace_status FROM backup_coa_limited_ibrahim_v1.meta;
SELECT COUNT(*) AS post_on_ap FROM backup_coa_limited_ibrahim_v1.post_apply_lines
WHERE account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312';
SELECT COUNT(*) AS still_on_legacy FROM journal_entry_lines
WHERE id IN ('677c74de-b677-4a6f-877f-b13e0ac66aaa','343c2586-2d86-4c24-9e03-3af493dada9d')
AND account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';
SELECT 'ID_LACE_NOT_IMPLEMENTED' AS status;
