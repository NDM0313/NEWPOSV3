-- Unified account ledger: include voided originals in official_gl when an active correction_reversal exists.
-- Fixes Ledger Statement V2 missing the pre-cancel debit after Cancel Payment on liquidity-linked JEs
-- (voidAllPaymentChainJournals sets is_void on the original; reversal alone made running balance wrong).

CREATE OR REPLACE FUNCTION public.get_unified_account_ledger(
  p_company_id uuid,
  p_account_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
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
BEGIN
  PERFORM public._unified_ledger_assert_caller_access(p_company_id, p_branch_id);

  WITH je_lines AS (
    SELECT
      jel.id AS jel_id,
      jel.debit AS dr,
      jel.credit AS cr,
      je.id AS je_id,
      je.entry_date::date AS ed,
      je.created_at AS ca,
      je.entry_no AS eno,
      je.reference_type AS ref_type,
      je.action_fingerprint AS action_fp,
      COALESCE(NULLIF(TRIM(COALESCE(je.description, '')), ''), NULLIF(TRIM(COALESCE(jel.description, '')), ''), '—') AS descr,
      je.branch_id AS bid,
      br.name AS bname,
      pay.voided_at AS pay_voided_at,
      s.status AS linked_sale_status
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
    LEFT JOIN branches br ON br.id = je.branch_id
    LEFT JOIN payments pay ON pay.id = je.payment_id
    LEFT JOIN sales s ON s.id = je.reference_id
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'sale_adjustment', 'sale_reversal')
    WHERE je.company_id = p_company_id
      AND jel.account_id = p_account_id
      AND public._unified_ledger_strict_branch_includes_row(p_branch_id, je.branch_id, je.reference_type)
      AND (
        COALESCE(je.is_void, FALSE) = FALSE
        OR (
          LOWER(TRIM(COALESCE(p_basis, 'official_gl'))) IN ('official_gl', 'audit_full_history')
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
  ),
  basis_filtered AS (
    SELECT j.*
    FROM je_lines j
    WHERE public._unified_ledger_basis_includes_row(
      COALESCE(p_basis, 'official_gl'), j.ref_type, j.action_fp, j.pay_voided_at, j.linked_sale_status::text
    )
  ),
  opening_calc AS (
    SELECT COALESCE(SUM(bf.dr - bf.cr), 0)::numeric AS ob
    FROM basis_filtered bf
    WHERE p_start_date IS NOT NULL AND bf.ed < p_start_date
  ),
  ob_val AS (SELECT COALESCE((SELECT ob FROM opening_calc), 0::numeric) AS v),
  ordered AS (
    SELECT bf.*, (SELECT v FROM ob_val) AS pob
    FROM basis_filtered bf
    WHERE (p_start_date IS NULL OR bf.ed >= p_start_date)
      AND (p_end_date IS NULL OR bf.ed <= p_end_date)
  ),
  with_running AS (
    SELECT
      o.*,
      o.pob + SUM(o.dr - o.cr) OVER (
        ORDER BY o.ed ASC, o.ca ASC NULLS LAST, o.eno ASC NULLS LAST, o.jel_id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS rb
    FROM ordered o
  )
  SELECT json_build_object(
    'account_id', p_account_id,
    'basis', COALESCE(p_basis, 'official_gl'),
    'branch_id', p_branch_id,
    'period_opening_balance', (SELECT v FROM ob_val),
    'row_count', (SELECT COUNT(*) FROM with_running),
    'rows', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'journal_entry_line_id', t.jel_id,
          'journal_entry_id', t.je_id,
          'entry_date', t.ed,
          'entry_no', t.eno,
          'reference_type', t.ref_type,
          'description', t.descr,
          'debit', t.dr,
          'credit', t.cr,
          'running_balance', t.rb,
          'branch_name', t.bname
        )
        ORDER BY t.ed ASC, t.ca ASC NULLS LAST, t.eno ASC NULLS LAST, t.jel_id ASC
      ) FROM with_running t),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$BODY$;

COMMENT ON FUNCTION public.get_unified_account_ledger(uuid, uuid, uuid, date, date, text) IS
  'Account GL ledger. official_gl includes voided originals paired with an active correction_reversal for audit parity.';
