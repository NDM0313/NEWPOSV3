-- AR/AP Reconciliation Center — Phase 1 baseline audit (read-only).
-- Targets: SL-0005, SL-0012, SL-0006, RCV-0017, RCV-0018, RCV-0019
-- Run: Get-Content scripts/sql/diag_ar_ap_center_baseline_audit.sql -Raw | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

\echo '=== A. Integrity lab snapshot (all branches, today) ==='
SELECT *
FROM ar_ap_integrity_lab_snapshot(
  (SELECT company_id FROM sales WHERE invoice_no IN ('SL-0005','SL-0012','SL-0006') LIMIT 1),
  NULL,
  CURRENT_DATE
);

\echo '=== B. Queue counts (company scope from sample sales) ==='
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no IN ('SL-0005','SL-0012','SL-0006') LIMIT 1
)
SELECT
  (SELECT COUNT(*) FROM v_ar_ap_unposted_documents u, co WHERE u.company_id = co.company_id) AS unposted_doc_count,
  (SELECT COUNT(*) FROM v_ar_ap_unmapped_journals v, co WHERE v.company_id = co.company_id) AS unmapped_line_count,
  (SELECT COUNT(DISTINCT journal_entry_id) FROM v_ar_ap_unmapped_journals v, co WHERE v.company_id = co.company_id) AS unmapped_distinct_je_count,
  (SELECT COUNT(*) FROM v_ar_ap_unmapped_journals v, co WHERE v.company_id = co.company_id AND v.control_bucket = 'AR') AS unmapped_ar_lines,
  (SELECT COUNT(*) FROM v_ar_ap_unmapped_journals v, co WHERE v.company_id = co.company_id AND v.ap_sub_bucket = 'supplier') AS unmapped_ap_supplier_lines,
  (SELECT COUNT(*) FROM v_ar_ap_unmapped_journals v, co WHERE v.company_id = co.company_id AND v.ap_sub_bucket = 'worker') AS unmapped_ap_worker_lines,
  (SELECT COUNT(*) FROM v_ar_ap_manual_adjustments m, co WHERE m.company_id = co.company_id) AS manual_je_count,
  (SELECT COUNT(*) FROM ar_ap_reconciliation_review_items r, co WHERE r.company_id = co.company_id) AS review_items_count;

\echo '=== C. Unposted queue — SL-0005, SL-0012, SL-0006 ==='
SELECT *
FROM v_ar_ap_unposted_documents
WHERE document_no IN ('SL-0005', 'SL-0012', 'SL-0006')
ORDER BY document_no;

\echo '=== D. Sales detail — SL-0005, SL-0012, SL-0006 ==='
SELECT
  s.id,
  s.invoice_no,
  s.status,
  s.customer_id,
  s.customer_name,
  s.total,
  s.paid_amount,
  s.due_amount,
  s.invoice_date,
  s.branch_id,
  b.name AS branch_name,
  s.company_id,
  EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.company_id = s.company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND lower(trim(COALESCE(je.reference_type, ''))) = 'sale'
      AND je.reference_id = s.id
  ) AS has_sale_je
FROM sales s
LEFT JOIN branches b ON b.id = s.branch_id
WHERE s.invoice_no IN ('SL-0005', 'SL-0012', 'SL-0006')
ORDER BY s.invoice_no;

\echo '=== E. Sale-linked JEs for SL-0005, SL-0012, SL-0006 ==='
SELECT
  s.invoice_no,
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id,
  je.is_void,
  je.branch_id,
  je.description
FROM sales s
JOIN journal_entries je ON je.reference_id = s.id
  AND je.company_id = s.company_id
  AND lower(trim(COALESCE(je.reference_type, ''))) = 'sale'
WHERE s.invoice_no IN ('SL-0005', 'SL-0012', 'SL-0006')
ORDER BY s.invoice_no, je.entry_date;

\echo '=== F. Unmapped queue lines — RCV-0017, RCV-0018, RCV-0019 (via payment ref) ==='
SELECT
  v.*,
  p.id AS payment_id,
  p.reference_number AS payment_ref,
  p.contact_id AS payment_contact_id,
  p.amount AS payment_amount,
  p.payment_date,
  p.reference_type AS payment_reference_type,
  p.reference_id AS payment_reference_id,
  p.voided_at AS payment_voided_at
FROM v_ar_ap_unmapped_journals v
LEFT JOIN journal_entries je ON je.id = v.journal_entry_id
LEFT JOIN payments p ON p.id = je.payment_id
  OR (je.reference_type = 'payment' AND je.reference_id = p.id)
WHERE p.reference_number IN ('RCV-0017', 'RCV-0018', 'RCV-0019')
   OR v.entry_no IN (
     SELECT je2.entry_no FROM journal_entries je2
     JOIN payments p2 ON p2.id = je2.payment_id OR (je2.reference_type = 'payment' AND je2.reference_id = p2.id)
     WHERE p2.reference_number IN ('RCV-0017', 'RCV-0018', 'RCV-0019')
   )
ORDER BY v.entry_no, v.journal_line_id;

\echo '=== G. Payments RCV-0017/18/19 + linked JEs ==='
SELECT
  p.id,
  p.reference_number,
  p.payment_date,
  p.amount,
  p.payment_type,
  p.reference_type,
  p.reference_id,
  p.contact_id,
  c.name AS contact_name,
  p.payment_account_id,
  a.code AS cash_account_code,
  a.name AS cash_account_name,
  p.branch_id,
  p.voided_at,
  je.id AS journal_entry_id,
  je.entry_no,
  je.is_void AS je_is_void,
  je.description AS je_description
FROM payments p
LEFT JOIN contacts c ON c.id = p.contact_id
LEFT JOIN accounts a ON a.id = p.payment_account_id
LEFT JOIN journal_entries je ON je.payment_id = p.id
  OR (je.reference_type = 'payment' AND je.reference_id = p.id)
WHERE p.reference_number IN ('RCV-0017', 'RCV-0018', 'RCV-0019')
ORDER BY p.reference_number, je.entry_no;

\echo '=== H. JE lines on RCV-linked entries (AR side) ==='
SELECT
  p.reference_number,
  je.entry_no,
  jel.id AS line_id,
  jel.debit,
  jel.credit,
  acc.code AS account_code,
  acc.name AS account_name,
  acc.linked_contact_id,
  lc.name AS linked_contact_name
FROM payments p
JOIN journal_entries je ON je.payment_id = p.id
  OR (je.reference_type = 'payment' AND je.reference_id = p.id)
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts acc ON acc.id = jel.account_id
LEFT JOIN contacts lc ON lc.id = acc.linked_contact_id
WHERE p.reference_number IN ('RCV-0017', 'RCV-0018', 'RCV-0019')
  AND COALESCE(je.is_void, FALSE) = FALSE
ORDER BY p.reference_number, je.entry_no, jel.debit DESC;

\echo '=== I. Unmapped view rows matching RCV JEs (by entry_no) ==='
SELECT v.*
FROM v_ar_ap_unmapped_journals v
WHERE v.journal_entry_id IN (
  SELECT je.id FROM payments p
  JOIN journal_entries je ON je.payment_id = p.id
    OR (je.reference_type = 'payment' AND je.reference_id = p.id)
  WHERE p.reference_number IN ('RCV-0017', 'RCV-0018', 'RCV-0019')
);

\echo '=== J. Review item status for sample keys ==='
SELECT r.*
FROM ar_ap_reconciliation_review_items r
WHERE r.item_key LIKE '%SL-0005%'
   OR r.item_key LIKE '%SL-0012%'
   OR r.item_key LIKE '%SL-0006%'
   OR r.item_key LIKE '%RCV-0017%'
   OR r.item_key LIKE '%RCV-0018%'
   OR r.item_key LIKE '%RCV-0019%'
ORDER BY r.updated_at DESC
LIMIT 50;

\echo '=== K. journal_party_contact_mapping for RCV JEs ==='
SELECT m.*
FROM journal_party_contact_mapping m
WHERE m.journal_entry_id IN (
  SELECT je.id FROM payments p
  JOIN journal_entries je ON je.payment_id = p.id
    OR (je.reference_type = 'payment' AND je.reference_id = p.id)
  WHERE p.reference_number IN ('RCV-0017', 'RCV-0018', 'RCV-0019')
);
