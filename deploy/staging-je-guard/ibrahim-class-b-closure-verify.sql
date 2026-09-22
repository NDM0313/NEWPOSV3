-- IBRAHIM Class B production repair — READ-ONLY closure verification
-- Target: live postgres. No DDL/DML.
\set ON_ERROR_STOP on

\echo '=== 0 identity ==='
SELECT current_database() AS db, current_database() = 'postgres' AS is_live;

\echo '=== 1 backup durable evidence ==='
SELECT run_id, scope, id_lace_status, company_id, created_at
FROM backup_coa_limited_ibrahim_v1.meta;

SELECT
  (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_v1.manifest) AS manifest_n,
  (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_v1.pre_apply_lines) AS pre_n,
  (SELECT COUNT(*) FROM backup_coa_limited_ibrahim_v1.post_apply_lines) AS post_n,
  (SELECT run_id FROM backup_coa_limited_ibrahim_v1.meta LIMIT 1) = 'ibrahim_v1_20260919143935' AS run_id_exact;

\echo '=== 2 live lines vs manifest ==='
SELECT
  m.line_id,
  m.entry_no,
  m.from_code AS manifest_from,
  m.to_code AS manifest_to,
  m.expected_debit,
  m.expected_credit,
  m.journal_entry_id AS manifest_je_id,
  jel.account_id AS live_account_id,
  a.code AS live_code,
  jel.debit AS live_debit,
  jel.credit AS live_credit,
  jel.journal_entry_id AS live_je_id,
  je.entry_no AS live_entry_no,
  je.entry_date,
  je.is_void,
  je.reference_type,
  je.reference_id,
  (jel.account_id = m.to_account_id) AS on_ap_target,
  (round(jel.debit,2) = m.expected_debit) AS debit_ok,
  (round(jel.credit,2) = m.expected_credit) AS credit_ok,
  (jel.journal_entry_id = m.journal_entry_id) AS je_id_ok,
  (je.entry_no = m.entry_no) AS entry_no_ok,
  (COALESCE(je.is_void,false) = false) AS non_void_ok
FROM backup_coa_limited_ibrahim_v1.manifest m
JOIN journal_entry_lines jel ON jel.id = m.line_id
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
ORDER BY m.entry_no;

\echo '=== 3 zero approved IBRAHIM lines still on legacy 210026 ==='
SELECT COUNT(*) AS approved_ibrahim_still_on_legacy
FROM journal_entry_lines jel
WHERE jel.id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
AND jel.account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c';

\echo '=== 4 accounting invariants: moved net + AP transition ==='
WITH lines AS (
  SELECT SUM(expected_debit - expected_credit) AS moved_net
  FROM backup_coa_limited_ibrahim_v1.manifest
),
ap AS (
  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS ap_net_now
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312'
    AND COALESCE(je.is_void, false) = false
),
ap_all AS (
  -- include voided for parity with apply NOTICE which summed all lines on account
  SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS ap_net_all_lines
  FROM journal_entry_lines jel
  WHERE jel.account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312'
)
SELECT
  (SELECT moved_net FROM lines) AS moved_net,
  (SELECT moved_net FROM lines) = 118275 AS moved_net_is_118275,
  (SELECT ap_net_all_lines FROM ap_all) AS ap_net_all_lines_now,
  (SELECT ap_net_now FROM ap) AS ap_net_nonvoid_now,
  -- expected transition from apply NOTICE (all-line sum style)
  -4740529.00 AS ap_before_apply_notice,
  -4622254.00 AS ap_after_apply_notice,
  (-4622254.00 - (-4740529.00)) AS expected_delta,
  (SELECT ap_net_all_lines FROM ap_all) = -4622254.00 AS ap_matches_after_notice;

\echo '=== 5 JE individual balance (0137 / 0138) ==='
SELECT je.entry_no, je.id,
       SUM(jel.debit) AS total_dr,
       SUM(jel.credit) AS total_cr,
       SUM(jel.debit) - SUM(jel.credit) AS diff,
       (SUM(jel.debit) = SUM(jel.credit)) AS balanced
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.id IN (
  SELECT journal_entry_id FROM backup_coa_limited_ibrahim_v1.manifest
)
GROUP BY je.entry_no, je.id
ORDER BY je.entry_no;

\echo '=== 6 company Trial Balance (non-void) ==='
WITH line_bal AS (
  SELECT
    COALESCE(SUM(jel.debit),0) AS total_dr,
    COALESCE(SUM(jel.credit),0) AS total_cr
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE je.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
    AND COALESCE(je.is_void, false) = false
)
SELECT total_dr, total_cr, total_dr - total_cr AS diff,
       (total_dr = total_cr) AS tb_balanced
FROM line_bal;

\echo '=== 7 collateral: JE headers unchanged; no extra JE from repair ==='
SELECT je.id, je.entry_no, je.entry_date, je.reference_type, je.reference_id,
       je.created_at, je.updated_at, je.is_void
FROM journal_entries je
WHERE je.id IN (
  '9ff212f9-00b0-4239-8be4-b42cb0c8ec72',
  'db8436ec-bc0d-464c-8507-4baf81c99efa'
)
ORDER BY je.entry_no;

-- pre vs post account_id change only for the two lines
SELECT
  p.id AS line_id,
  p.account_id AS pre_account_id,
  post.account_id AS post_account_id,
  (p.account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c') AS pre_was_legacy,
  (post.account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312') AS post_is_ap,
  (round(p.debit,2) = round(post.debit,2) AND round(p.credit,2) = round(post.credit,2)) AS amounts_unchanged,
  (p.journal_entry_id = post.journal_entry_id) AS same_je
FROM backup_coa_limited_ibrahim_v1.pre_apply_lines p
JOIN backup_coa_limited_ibrahim_v1.post_apply_lines post ON post.id = p.id
ORDER BY p.entry_no;

\echo '=== 8 no other party repairs in this backup schema ==='
SELECT scope, id_lace_status FROM backup_coa_limited_ibrahim_v1.meta;
SELECT COUNT(*) AS non_ibrahim_manifest_rows
FROM backup_coa_limited_ibrahim_v1.manifest m
WHERE m.line_id NOT IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
);

\echo '=== 9 attribution: AP leaf + contact; not on 210026 ==='
SELECT a.id, a.code, a.name, a.linked_contact_id, c.code AS contact_code, c.name AS contact_name
FROM accounts a
LEFT JOIN contacts c ON c.id = a.linked_contact_id
WHERE a.id = '2c56a1d1-e31d-433f-85af-ce3fd4729312';

-- Party/AP ledger path: lines for AP leaf for these two JEs
SELECT jel.id AS line_id, je.entry_no, a.code, jel.debit, jel.credit,
       c.code AS contact_code, c.name AS contact_name
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
LEFT JOIN contacts c ON c.id = a.linked_contact_id
WHERE jel.id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
ORDER BY je.entry_no;

-- Count how many times 118275 appears as these two line debits on AP (no duplicate ghost lines)
SELECT COUNT(*) AS ibrahim_repair_lines_on_ap
FROM journal_entry_lines
WHERE id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
AND account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312';

\echo '=== 10 guard still armed + remap present ==='
SELECT
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='journal_entry_lines'
      AND t.tgname='trg_guard_journal_entry_line_account' AND t.tgenabled <> 'D'
  ) AS trg_enabled,
  EXISTS (
    SELECT 1 FROM journal_account_verified_remaps
    WHERE company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
      AND from_account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'
      AND to_account_id = '2c56a1d1-e31d-433f-85af-ce3fd4729312'
  ) AS ibrahim_remap_present;

\echo '=== 11 payments collateral (no PAY created for these JE refs) ==='
SELECT COUNT(*) AS payments_referencing_these_jes
FROM payments p
WHERE p.id IN (
  SELECT je.payment_id FROM journal_entries je
  WHERE je.id IN (
    '9ff212f9-00b0-4239-8be4-b42cb0c8ec72',
    'db8436ec-bc0d-464c-8507-4baf81c99efa'
  ) AND je.payment_id IS NOT NULL
)
OR p.reference_id::text IN (
  '9ff212f9-00b0-4239-8be4-b42cb0c8ec72',
  'db8436ec-bc0d-464c-8507-4baf81c99efa'
);

-- Repair creates no new JE: entry_no still unique single rows
SELECT entry_no, COUNT(*) FROM journal_entries
WHERE company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
  AND entry_no IN ('JE-0137','JE-0138')
GROUP BY entry_no;

SELECT 'ID_LACE_NOT_IMPLEMENTED' AS id_lace_status;
