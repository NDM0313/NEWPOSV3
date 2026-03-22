-- Journal source-of-truth: read-only validation views for tooling and CI-style checks.
-- Actual line table: journal_entry_lines (FK journal_entry_id → journal_entries.id).
-- Non-void business journals only where noted (is_void = false).

-- 1) Per-company TB totals from lines (non-void journals only).
--    If every journal is balanced: SUM(total_debit) should equal SUM(total_credit) per company.
CREATE OR REPLACE VIEW public.v_accounting_tb_company_totals AS
SELECT
  je.company_id,
  COALESCE(SUM(jel.debit), 0)::NUMERIC(15, 2) AS total_debit,
  COALESCE(SUM(jel.credit), 0)::NUMERIC(15, 2) AS total_credit,
  (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))::NUMERIC(15, 2) AS difference
FROM public.journal_entry_lines jel
INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
WHERE COALESCE(je.is_void, FALSE) = FALSE
GROUP BY je.company_id;

COMMENT ON VIEW public.v_accounting_tb_company_totals IS
  'Sum of all debits/credits from non-void journal lines, per company. difference should be 0 if all journals balance.';

-- 2) Unbalanced non-void journals (detail).
CREATE OR REPLACE VIEW public.v_accounting_unbalanced_journals AS
SELECT
  je.company_id,
  je.id AS journal_entry_id,
  je.entry_no,
  je.entry_date,
  COALESCE(SUM(jel.debit), 0)::NUMERIC(15, 2) AS total_debit,
  COALESCE(SUM(jel.credit), 0)::NUMERIC(15, 2) AS total_credit,
  (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))::NUMERIC(15, 2) AS imbalance
FROM public.journal_entries je
LEFT JOIN public.journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE COALESCE(je.is_void, FALSE) = FALSE
GROUP BY je.id, je.company_id, je.entry_no, je.entry_date
HAVING ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) >= 0.01;

COMMENT ON VIEW public.v_accounting_unbalanced_journals IS
  'Non-void journal entries where sum(debit) != sum(credit).';

-- 3) Posted headers with zero lines (often draft or pipeline bug).
CREATE OR REPLACE VIEW public.v_accounting_journals_missing_lines AS
SELECT
  je.id AS journal_entry_id,
  je.company_id,
  je.entry_no,
  je.entry_date,
  je.reference_type,
  je.reference_id
FROM public.journal_entries je
WHERE COALESCE(je.is_void, FALSE) = FALSE
  AND NOT EXISTS (
    SELECT 1
    FROM public.journal_entry_lines jel
    WHERE jel.journal_entry_id = je.id
  );

COMMENT ON VIEW public.v_accounting_journals_missing_lines IS
  'Non-void journal_entries with no lines. May be intentional drafts—investigate if unexpected.';

-- 4) Lines with no parent journal (should be empty if FK is enforced).
CREATE OR REPLACE VIEW public.v_accounting_lines_orphan_journal AS
SELECT jel.*
FROM public.journal_entry_lines jel
LEFT JOIN public.journal_entries je ON je.id = jel.journal_entry_id
WHERE je.id IS NULL;

COMMENT ON VIEW public.v_accounting_lines_orphan_journal IS
  'journal_entry_lines with missing journal_entries row. Normally impossible with ON DELETE RESTRICT/CASCADE.';

-- 5) Data quality: same line has both debit and credit materially > 0.
CREATE OR REPLACE VIEW public.v_accounting_lines_both_sides AS
SELECT
  jel.id AS line_id,
  je.company_id,
  jel.journal_entry_id,
  jel.account_id,
  jel.debit,
  jel.credit
FROM public.journal_entry_lines jel
INNER JOIN public.journal_entries je ON je.id = jel.journal_entry_id
WHERE jel.debit > 0.01 AND jel.credit > 0.01;

COMMENT ON VIEW public.v_accounting_lines_both_sides IS
  'Lines with both debit and credit > 0.01 (usually invalid for standard double-entry lines).';

GRANT SELECT ON public.v_accounting_tb_company_totals TO authenticated;
GRANT SELECT ON public.v_accounting_unbalanced_journals TO authenticated;
GRANT SELECT ON public.v_accounting_journals_missing_lines TO authenticated;
GRANT SELECT ON public.v_accounting_lines_orphan_journal TO authenticated;
GRANT SELECT ON public.v_accounting_lines_both_sides TO authenticated;
