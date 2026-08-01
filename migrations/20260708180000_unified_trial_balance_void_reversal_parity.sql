-- Align get_unified_trial_balance with get_unified_account_ledger void inclusion
-- for official_gl / audit_full_history: include voided originals that have an active
-- correction_reversal (Cancel Payment pairs net correctly on both surfaces).
-- Contract: AS closing (as-of end) = TB net_balance for the same leaf GL account.

CREATE OR REPLACE FUNCTION public.get_unified_trial_balance(
  p_company_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_as_of_date date DEFAULT NULL,
  p_basis text DEFAULT 'official_gl'
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $BODY$
DECLARE
  v_result json;
  v_basis text := LOWER(TRIM(COALESCE(p_basis, 'official_gl')));
BEGIN
  PERFORM public._unified_ledger_assert_caller_access(p_company_id, p_branch_id);

  WITH je_lines AS (
    SELECT
      jel.account_id AS aid,
      jel.debit AS dr,
      jel.credit AS cr,
      je.entry_date::date AS ed,
      je.reference_type AS ref_type,
      je.action_fingerprint AS action_fp,
      pay.voided_at AS pay_voided_at,
      s.status AS linked_sale_status
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
    LEFT JOIN payments pay ON pay.id = je.payment_id
    LEFT JOIN sales s ON s.id = je.reference_id
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'sale_adjustment', 'sale_reversal')
    WHERE je.company_id = p_company_id
      AND (
        COALESCE(je.is_void, FALSE) = FALSE
        OR (
          v_basis IN ('official_gl', 'audit_full_history')
          AND EXISTS (
            SELECT 1
            FROM journal_entries rev
            WHERE rev.company_id = je.company_id
              AND rev.reference_type = 'correction_reversal'
              AND rev.reference_id = je.id
              AND COALESCE(rev.is_void, FALSE) = FALSE
          )
        )
      )
      AND public._unified_ledger_strict_branch_includes_row(p_branch_id, je.branch_id, je.reference_type)
      AND (p_as_of_date IS NULL OR je.entry_date::date <= p_as_of_date)
  ),
  basis_filtered AS (
    SELECT j.*
    FROM je_lines j
    WHERE public._unified_ledger_basis_includes_row(
      COALESCE(p_basis, 'official_gl'), j.ref_type, j.action_fp, j.pay_voided_at, j.linked_sale_status::text
    )
  ),
  per_account AS (
    SELECT
      bf.aid,
      SUM(bf.dr)::numeric AS total_debit,
      SUM(bf.cr)::numeric AS total_credit,
      SUM(bf.dr - bf.cr)::numeric AS net_balance
    FROM basis_filtered bf
    GROUP BY bf.aid
  )
  SELECT json_build_object(
    'company_id', p_company_id,
    'branch_id', p_branch_id,
    'as_of_date', p_as_of_date,
    'basis', COALESCE(p_basis, 'official_gl'),
    'total_debit', COALESCE((SELECT SUM(total_debit) FROM per_account), 0),
    'total_credit', COALESCE((SELECT SUM(total_credit) FROM per_account), 0),
    'difference', COALESCE((SELECT SUM(total_debit - total_credit) FROM per_account), 0),
    'account_count', (SELECT COUNT(*) FROM per_account),
    'accounts', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'account_id', pa.aid,
          'account_code', acc.code,
          'account_name', acc.name,
          'account_type', acc.type,
          'total_debit', pa.total_debit,
          'total_credit', pa.total_credit,
          'net_balance', pa.net_balance
        )
        ORDER BY acc.code NULLS LAST
      )
      FROM per_account pa
      INNER JOIN accounts acc ON acc.id = pa.aid),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$BODY$;

COMMENT ON FUNCTION public.get_unified_trial_balance(uuid, uuid, date, text) IS
  'Unified trial balance (as-of). official_gl/audit_full_history include voided originals paired with active correction_reversal — matches get_unified_account_ledger.';

GRANT EXECUTE ON FUNCTION public.get_unified_trial_balance(uuid, uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_trial_balance(uuid, uuid, date, text) TO service_role;
