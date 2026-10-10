-- Include company-wide (NULL branch_id) journal / GL adjustment families under a
-- branch-specific filter. Same philosophy as opening_balance / coa_opening.
-- Fixes Trial Balance dropping JV-000296-style capital transfers when header
-- branch is set (e.g. DIN CHINA) while Account Statement uses all-branches.

CREATE OR REPLACE FUNCTION public._unified_ledger_strict_branch_includes_row(
  p_filter_branch_id uuid,
  p_row_branch_id uuid,
  p_reference_type text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $BODY$
  SELECT CASE
    WHEN p_filter_branch_id IS NULL THEN TRUE
    WHEN p_row_branch_id = p_filter_branch_id THEN TRUE
    WHEN p_row_branch_id IS NULL AND (
      LOWER(TRIM(COALESCE(p_reference_type, ''))) LIKE 'opening_balance%'
      OR LOWER(TRIM(COALESCE(p_reference_type, ''))) IN (
        'system_seed',
        'coa_opening',
        'journal',
        'manual_journal',
        'gl_correction',
        'correction_reversal',
        ''
      )
    ) THEN TRUE
    ELSE FALSE
  END;
$BODY$;

COMMENT ON FUNCTION public._unified_ledger_strict_branch_includes_row(uuid, uuid, text) IS
  'Branch filter for unified ledgers. NULL-branch openings and company-level journals/gl_correction/correction_reversal are included under any branch filter so TB cash/bank Closing matches all-branches Account Statement. Sales/purchases/payments with NULL branch stay excluded when a branch is selected.';

GRANT EXECUTE ON FUNCTION public._unified_ledger_strict_branch_includes_row(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._unified_ledger_strict_branch_includes_row(uuid, uuid, text) TO service_role;
