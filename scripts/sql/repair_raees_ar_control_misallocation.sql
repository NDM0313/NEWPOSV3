-- RAEES LHR — relink payment AR credits from control 1100 → party AR-11D58D
--
-- Tie-out finding (2026-06-16):
--   Sale DC-0003 posted Dr 965,540 to AR-11D58D (JE-0037).
--   Six payments total 965,540 (operational paid_amount correct).
--   RCV-0003, RCV-0030, RCV-0054 credited control 1100 (600,000) instead of AR-11D58D.
--   RCV-0080, RCV-0085, RCV-0113 correctly credited AR-11D58D (365,540).
--   Party GL net = 600,000 orphan; operational receivables = 0.
--
-- MURAD RAMDAS — NO REPAIR: GL 257,140 = operational due on open sale DC-0007 (unpaid).
--
-- VPS dry-run:
--   ssh dincouture-vps "docker exec -i supabase-db psql -U supabase_admin -d postgres" < scripts/sql/repair_raees_ar_control_misallocation.sql
--
-- To APPLY: run the APPLY block below (dry-run sections above are safe to re-run).

\set company_id '30bd8592-3384-4f34-899a-f3907e336485'
\set party_account_id '33a061e0-f07a-4348-813c-f9c92e794927'
\set control_ar_id '51ef008a-00ca-48cd-94f8-4fdad79b7065'

-- === DRY-RUN: lines to move ===
SELECT
  jel.id AS line_id,
  je.entry_no,
  a.code AS from_account,
  ROUND(jel.credit::numeric, 2) AS credit,
  'AR-11D58D' AS to_account
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.company_id = :'company_id'::uuid
  AND je.entry_no IN ('RCV-0003', 'RCV-0030', 'RCV-0054')
  AND jel.account_id = :'control_ar_id'::uuid
  AND jel.credit > 0;

-- === DRY-RUN: party GL net before ===
SELECT
  c.name,
  a.code,
  ROUND(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 2) AS gl_net
FROM accounts a
JOIN contacts c ON c.id = a.linked_contact_id
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
  AND je.company_id = :'company_id'::uuid
  AND COALESCE(je.is_void, false) = false
WHERE a.id = :'party_account_id'::uuid
GROUP BY c.name, a.code;

-- === APPLY (applied 2026-06-16 on VPS — re-run only if dry-run shows unmoved lines) ===
-- BEGIN;
-- UPDATE journal_entry_lines jel ...
-- COMMIT;
