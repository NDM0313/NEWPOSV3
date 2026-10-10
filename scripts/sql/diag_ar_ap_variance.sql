-- AR/AP receivables variance diagnostic (read-only).
-- Compare KPI variance card to server breakdown buckets.

-- 1) Variance breakdown RPC (requires migration 20260619120000+)
SELECT ar_ap_receivables_variance_breakdown(
  (SELECT id FROM companies WHERE name ILIKE '%DIN BRIDAL%' LIMIT 1),
  NULL,
  CURRENT_DATE
);

-- 2) Integrity lab snapshot vs party GL (as-of parity)
WITH co AS (SELECT id FROM companies WHERE name ILIKE '%DIN BRIDAL%' LIMIT 1)
SELECT
  s.gl_ar_net_dr_minus_cr AS gl_ar_raw,
  (SELECT COALESCE(SUM(GREATEST(0, gl_ar_receivable)), 0)
   FROM get_contact_party_gl_balances((SELECT id FROM co), NULL, CURRENT_DATE)) AS op_clamped_as_of,
  (SELECT COALESCE(SUM(gl_ar_receivable), 0)
   FROM get_contact_party_gl_balances((SELECT id FROM co), NULL, CURRENT_DATE)) AS op_signed_as_of
FROM ar_ap_integrity_lab_snapshot((SELECT id FROM co), NULL, CURRENT_DATE) s;

-- 3) Negative contacts → linked unposted order sales (Patras/Mahvish class)
WITH co AS (SELECT id FROM companies WHERE name ILIKE '%DIN BRIDAL%' LIMIT 1),
neg AS (
  SELECT b.contact_id, c.name, b.gl_ar_receivable
  FROM get_contact_party_gl_balances((SELECT id FROM co), NULL, CURRENT_DATE) b
  JOIN contacts c ON c.id = b.contact_id
  WHERE b.gl_ar_receivable < -0.001
)
SELECT
  n.name AS contact_name,
  n.gl_ar_receivable AS signed_ar,
  s.invoice_no,
  s.status,
  s.paid_amount,
  s.invoice_date
FROM neg n
LEFT JOIN sales s ON s.company_id = (SELECT id FROM co)
  AND s.customer_id = n.contact_id
  AND lower(trim(s.status::text)) <> 'final'
  AND COALESCE(s.paid_amount, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.company_id = (SELECT id FROM co)
      AND COALESCE(je.is_void, false) = false
      AND lower(trim(je.reference_type::text)) = 'sale'
      AND je.reference_id = s.id
  )
ORDER BY n.gl_ar_receivable, s.invoice_no;

-- 4) Unmapped gl_correction lines before/after whitelist (should be 0 after 20260620100000)
WITH co AS (SELECT id FROM companies WHERE name ILIKE '%DIN BRIDAL%' LIMIT 1)
SELECT
  count(*)::int AS unmapped_gl_correction_lines,
  COALESCE(sum(v.credit - v.debit), 0) AS net_cr
FROM v_reconciliation_ar_ap_line_audit v
WHERE v.company_id = (SELECT id FROM co)
  AND v.is_unmapped_heuristic = true
  AND lower(COALESCE(v.reference_type, '')) = 'gl_correction';

-- 5) RCV-0008 / rental payment metadata classification
WITH co AS (SELECT id FROM companies WHERE name ILIKE '%DIN BRIDAL%' LIMIT 1)
SELECT
  je.entry_no,
  je.reference_type AS je_reference_type,
  p.reference_type AS payment_reference_type,
  p.reference_number,
  v.is_unmapped_heuristic,
  a.linked_contact_id IS NOT NULL AS has_party_subledger
FROM journal_entries je
JOIN payments p ON p.id = je.payment_id
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
JOIN accounts a ON a.id = jel.account_id
JOIN v_reconciliation_ar_ap_line_audit v ON v.journal_line_id = jel.id
WHERE je.company_id = (SELECT id FROM co)
  AND COALESCE(je.is_void, false) = false
  AND p.reference_number ILIKE '%RCV-0008%'
LIMIT 5;

-- 6) Rental repair eligible vs corrected
WITH co AS (SELECT id FROM companies WHERE name ILIKE '%DIN BRIDAL%' LIMIT 1)
SELECT
  'eligible' AS bucket,
  count(*)::int AS line_count,
  COALESCE(sum(amount), 0) AS total_amount
FROM list_rental_1100_leakage_defects((SELECT id FROM co), NULL)
UNION ALL
SELECT
  'corrected_je' AS bucket,
  count(*)::int,
  COALESCE(sum(COALESCE(je.total_debit, 0)), 0)
FROM journal_entries je
WHERE je.company_id = (SELECT id FROM co)
  AND je.action_fingerprint LIKE 'developer_repair:gl_correction:rental-1100-leakage:%'
  AND COALESCE(je.is_void, false) = false;
