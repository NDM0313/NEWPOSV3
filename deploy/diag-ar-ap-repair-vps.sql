-- AR/AP repair Phase 0 diagnostics (read-only)
--
-- Supabase SQL editor: run ONE section at a time (select the query block, then Run).
--   Do not use psql meta-commands (\echo etc.) — they are not valid SQL.
--
-- VPS psql (all sections):
--   Get-Content deploy/diag-ar-ap-repair-vps.sql | ssh dincouture-vps "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=0"

-- === 1. schema_migrations 20260617-20 ===
SELECT name FROM schema_migrations
WHERE name LIKE '20260617%' OR name LIKE '20260618%' OR name LIKE '20260619%' OR name LIKE '20260620%'
ORDER BY 1;

-- === 2. JV-000203 / JE-0160 / JE-0161 fingerprint ===
SELECT entry_no, action_fingerprint, reference_type, LEFT(COALESCE(description, ''), 80) AS description
FROM journal_entries
WHERE entry_no IN ('JV-000203', 'JE-0160', 'JE-0161')
  AND COALESCE(is_void, false) = false
ORDER BY entry_no;

-- === 3. company_id (from HQ-SL-0003) ===
SELECT company_id FROM sales WHERE invoice_no = 'HQ-SL-0003' LIMIT 1;

-- === 4. list_rental_1100_leakage_defects ===
SELECT defect_id, entry_no, amount, customer_name
FROM list_rental_1100_leakage_defects(
  (SELECT company_id FROM sales WHERE invoice_no = 'HQ-SL-0003' LIMIT 1),
  NULL
);

-- === 5. variance breakdown (summary) ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no = 'HQ-SL-0003' LIMIT 1
),
vb AS (
  SELECT ar_ap_receivables_variance_breakdown(co.company_id, NULL, CURRENT_DATE) AS payload
  FROM co
)
SELECT
  payload->>'varianceTotal' AS variance_total,
  payload->'buckets' AS buckets,
  payload->'negativeClampedContacts' AS negative_clamped_contacts
FROM vb;

-- === 6. unmapped 1100 sample JEs (9850 bucket) ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no = 'HQ-SL-0003' LIMIT 1
),
samples AS (
  SELECT jsonb_array_elements_text(
    (
      SELECT b->'sampleJournalEntryIds'
      FROM co,
           LATERAL jsonb_array_elements(
             (ar_ap_receivables_variance_breakdown(co.company_id, NULL, CURRENT_DATE)->'buckets')
           ) AS b
      WHERE b->>'key' = 'unmapped_control_1100'
      LIMIT 1
    )
  )::uuid AS je_id
)
SELECT
  je.entry_no,
  je.entry_date,
  je.reference_type,
  LEFT(COALESCE(je.description, ''), 100) AS description,
  a.code AS account_code,
  ROUND(jel.debit::numeric, 2) AS debit,
  ROUND(jel.credit::numeric, 2) AS credit
FROM samples s
INNER JOIN journal_entries je ON je.id = s.je_id
INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
INNER JOIN accounts a ON a.id = jel.account_id
ORDER BY je.entry_no, a.code;

-- === 7. negative AR contacts (variance breakdown JSON) ===
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no = 'HQ-SL-0003' LIMIT 1
),
vb AS (
  SELECT ar_ap_receivables_variance_breakdown(co.company_id, NULL, CURRENT_DATE) AS payload
  FROM co
)
SELECT
  c->>'contactName' AS contact_name,
  c->>'signedAr' AS signed_ar,
  c->>'clampedLoss' AS clamped_loss,
  c->'linkedUnpostedSales' AS linked_unposted_sales
FROM vb,
     jsonb_array_elements(vb.payload->'negativeClampedContacts') AS c;

-- === 8. JV-000205 line detail ===
SELECT
  je.entry_no,
  je.reference_type,
  je.is_void,
  a.code AS account_code,
  ROUND(jel.debit::numeric, 2) AS debit,
  ROUND(jel.credit::numeric, 2) AS credit,
  LEFT(COALESCE(jel.description, je.description, ''), 80) AS line_desc
FROM journal_entries je
INNER JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
INNER JOIN accounts a ON a.id = jel.account_id
WHERE je.entry_no = 'JV-000205'
  AND COALESCE(je.is_void, false) = false
ORDER BY a.code;

-- === 9. payables three-way (same company / as-of) ===
-- operational_rpc = get_contact_balances_summary (document due). When app uses GL cutover,
-- the UI "Operational payables" card matches party_gl_clamped instead (see contactService).
WITH co AS (
  SELECT company_id FROM sales WHERE invoice_no = 'HQ-SL-0003' LIMIT 1
),
op AS (
  SELECT COALESCE(SUM(cbs.payables), 0) AS operational_rpc
  FROM get_contact_balances_summary((SELECT company_id FROM co), NULL) cbs
),
party AS (
  SELECT
    COALESCE(SUM(b.gl_ap_payable), 0) AS party_gl_signed,
    COALESCE(SUM(GREATEST(0, b.gl_ap_payable)), 0) AS party_gl_clamped
  FROM get_contact_party_gl_balances((SELECT company_id FROM co), NULL, CURRENT_DATE) b
),
ctrl AS (
  SELECT COALESCE(s.gl_ap_net_credit, 0) AS control_ap_cr_minus_dr
  FROM ar_ap_integrity_lab_snapshot((SELECT company_id FROM co), NULL, CURRENT_DATE) s
)
SELECT
  op.operational_rpc,
  party.party_gl_clamped AS operational_ui_parity_clamped,
  party.party_gl_signed,
  ctrl.control_ap_cr_minus_dr,
  party.party_gl_signed - ctrl.control_ap_cr_minus_dr AS party_vs_control
FROM op, party, ctrl;
