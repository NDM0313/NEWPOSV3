-- Stamp remaining NULL-branch DIN CHINA journals onto primary branch
-- (same pattern as JV-000296). Does not change amounts — only branch_id.
--
-- Entries: JE-0004, JV-000297, JE-0005, JV-000310
-- Company: 30bd8592-3384-4f34-899a-f3907e336485
-- Branch:  92f4184e-ee9b-4b6c-8e76-10ee1d166f55
--
-- Apply on VPS as postgres (or supabase_admin):
--   scp scripts/sql/repair_din_china_null_branch_journals_stamp.sql dincouture-vps:/tmp/
--   ssh dincouture-vps "cat /tmp/repair_din_china_null_branch_journals_stamp.sql | docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"

BEGIN;

CREATE TABLE IF NOT EXISTS _bak_je_null_branch_stamp_20260708 (
  id uuid PRIMARY KEY,
  entry_no text,
  entry_date date,
  reference_type text,
  branch_id_before uuid,
  description text,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO _bak_je_null_branch_stamp_20260708 (
  id, entry_no, entry_date, reference_type, branch_id_before, description
)
SELECT
  je.id,
  je.entry_no,
  je.entry_date::date,
  je.reference_type,
  je.branch_id,
  je.description
FROM journal_entries je
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND je.entry_no IN ('JE-0004', 'JV-000297', 'JE-0005', 'JV-000310')
  AND je.branch_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE journal_entries je
SET
  branch_id = '92f4184e-ee9b-4b6c-8e76-10ee1d166f55',
  updated_at = NOW()
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND je.entry_no IN ('JE-0004', 'JV-000297', 'JE-0005', 'JV-000310')
  AND je.branch_id IS NULL;

-- Verify stamp
SELECT
  je.entry_no,
  je.reference_type,
  je.branch_id,
  je.branch_id = '92f4184e-ee9b-4b6c-8e76-10ee1d166f55' AS stamped_ok
FROM journal_entries je
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND je.entry_no IN ('JE-0004', 'JV-000297', 'JE-0005', 'JV-000310')
ORDER BY je.entry_no;

-- Remaining NULL-branch non-void journal-family lines for this company
SELECT
  COALESCE(NULLIF(TRIM(je.reference_type), ''), '(empty)') AS ref_type,
  COUNT(*) AS je_count
FROM journal_entries je
WHERE je.company_id = '30bd8592-3384-4f34-899a-f3907e336485'
  AND je.branch_id IS NULL
  AND COALESCE(je.is_void, false) = false
  AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN (
    'journal', 'manual_journal', 'gl_correction', 'correction_reversal', ''
  )
GROUP BY 1
ORDER BY 1;

COMMIT;
