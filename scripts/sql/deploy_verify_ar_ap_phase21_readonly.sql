-- Phase 2.1 post-deploy read-only smoke (no mutations)
SELECT 'vps_commit_check' AS section;
SELECT '483255e7 expected on VPS repo' AS note;

SELECT 'order_sales_1a' AS section;
SELECT invoice_number, status FROM sales
WHERE invoice_number IN ('SL-0005','SL-0006','SL-0012')
ORDER BY invoice_number;

SELECT 'rcv0008_unmapped' AS section;
SELECT entry_no, account_code, contact_mapping_status, reason
FROM v_ar_ap_unmapped_journals
WHERE entry_no = 'RCV-0008';

SELECT 'ar_cus0060_net' AS section;
SELECT COALESCE(SUM(jel.debit),0)-COALESCE(SUM(jel.credit),0) AS net
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id=jel.journal_entry_id AND COALESCE(je.is_void,false)=false
JOIN accounts acc ON acc.id=jel.account_id
WHERE acc.code='AR-CUS0060';
