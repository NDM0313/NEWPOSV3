-- IBRAHIM Class B ONLY — durable backup schema backup_coa_limited_ibrahim_v1.
-- ID LACE: NOT IMPLEMENTED in this package (see README).
-- Do not change schema name without updating 02_apply / 03_rollback in lockstep.

\set ON_ERROR_STOP on

CREATE SCHEMA IF NOT EXISTS backup_coa_limited_ibrahim_v1;

DO $$
BEGIN
  IF to_regclass('public.journal_account_verified_remaps') IS NULL THEN
    RAISE EXCEPTION 'Guard migration not installed — refuse backup for repair';
  END IF;
  IF to_regprocedure('public.repair_restore_journal_entry_line_account(uuid,uuid,uuid,uuid,numeric,numeric,uuid)') IS NULL THEN
    RAISE EXCEPTION 'repair_restore_journal_entry_line_account missing — refuse backup';
  END IF;
END $$;

DROP TABLE IF EXISTS backup_coa_limited_ibrahim_v1.post_apply_lines;
DROP TABLE IF EXISTS backup_coa_limited_ibrahim_v1.pre_apply_lines;
DROP TABLE IF EXISTS backup_coa_limited_ibrahim_v1.manifest;
DROP TABLE IF EXISTS backup_coa_limited_ibrahim_v1.meta;

CREATE TABLE backup_coa_limited_ibrahim_v1.meta (
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  scope text NOT NULL DEFAULT 'IBRAHIM_CLASS_B_ONLY',
  id_lace_status text NOT NULL DEFAULT 'NOT_IMPLEMENTED',
  automatic_remap_scope text NOT NULL DEFAULT 'journal_account_verified_remaps (separate from this historical repair)',
  expected_line_count int NOT NULL DEFAULT 2
);

INSERT INTO backup_coa_limited_ibrahim_v1.meta (company_id)
VALUES ('e08a04af-22a8-4869-9b4d-da31fce13158');

CREATE TABLE backup_coa_limited_ibrahim_v1.manifest (
  line_id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  journal_entry_id uuid NOT NULL,
  entry_no text NOT NULL,
  is_void boolean NOT NULL,
  from_account_id uuid NOT NULL,
  from_code text NOT NULL,
  to_account_id uuid NOT NULL,
  to_code text NOT NULL,
  expected_debit numeric(15,2) NOT NULL,
  expected_credit numeric(15,2) NOT NULL
);

INSERT INTO backup_coa_limited_ibrahim_v1.manifest (
  line_id, company_id, journal_entry_id, entry_no, is_void,
  from_account_id, from_code, to_account_id, to_code, expected_debit, expected_credit
)
SELECT
  jel.id,
  je.company_id,
  je.id,
  je.entry_no,
  COALESCE(je.is_void, false),
  jel.account_id,
  a.code,
  '2c56a1d1-e31d-433f-85af-ce3fd4729312'::uuid,
  'AP-SUPZHD0026',
  round(jel.debit, 2),
  round(jel.credit, 2)
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE jel.id IN (
  '677c74de-b677-4a6f-877f-b13e0ac66aaa',
  '343c2586-2d86-4c24-9e03-3af493dada9d'
)
AND je.company_id = 'e08a04af-22a8-4869-9b4d-da31fce13158'
AND jel.account_id = '3f1440dd-2e2c-4439-8bb4-a9c54cb3af0c'
AND COALESCE(je.is_void, false) = false
AND a.code = '210026'
AND je.entry_no IN ('JE-0137', 'JE-0138');

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n FROM backup_coa_limited_ibrahim_v1.manifest;
  IF n <> 2 THEN
    RAISE EXCEPTION 'BACKUP_MANIFEST_COUNT % <> 2 — lines drifted or wrong company/account/entry_no', n;
  END IF;
END $$;

CREATE TABLE backup_coa_limited_ibrahim_v1.pre_apply_lines AS
SELECT jel.*, je.company_id AS je_company_id, je.entry_no, je.is_void, je.entry_date
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.id IN (
  SELECT line_id FROM backup_coa_limited_ibrahim_v1.manifest
);

DO $$
DECLARE
  bad int;
BEGIN
  SELECT COUNT(*) INTO bad
  FROM backup_coa_limited_ibrahim_v1.manifest m
  JOIN backup_coa_limited_ibrahim_v1.pre_apply_lines p ON p.id = m.line_id
  WHERE round(p.debit, 2) IS DISTINCT FROM m.expected_debit
     OR round(p.credit, 2) IS DISTINCT FROM m.expected_credit
     OR p.account_id IS DISTINCT FROM m.from_account_id
     OR p.journal_entry_id IS DISTINCT FROM m.journal_entry_id
     OR p.je_company_id IS DISTINCT FROM m.company_id
     OR COALESCE(p.is_void, false) <> false
     OR p.entry_no IS DISTINCT FROM m.entry_no;
  IF bad <> 0 THEN
    RAISE EXCEPTION 'BACKUP_VALIDATION_FAILED: % rows mismatch manifest', bad;
  END IF;
  RAISE NOTICE 'BACKUP_OK: durable schema backup_coa_limited_ibrahim_v1 with 2 IBRAHIM lines (ID LACE=NOT_IMPLEMENTED)';
END $$;
