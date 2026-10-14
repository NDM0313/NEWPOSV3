-- Extend get_unified_trial_balance with presentation mode:
--   canonical (default) — roll source accounts via account_reporting_aliases
--   raw — exact historical account_id grouping (pre-alias behavior)
-- Totals Dr/Cr/difference are presentation-invariant. No JE rewrite.

BEGIN;

DROP FUNCTION IF EXISTS public.get_unified_trial_balance(uuid, uuid, date, text);

CREATE OR REPLACE FUNCTION public.get_unified_trial_balance(
  p_company_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_as_of_date date DEFAULT NULL,
  p_basis text DEFAULT 'official_gl',
  p_presentation text DEFAULT 'canonical'
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
  v_presentation text := LOWER(TRIM(COALESCE(p_presentation, 'canonical')));
BEGIN
  PERFORM public._unified_ledger_assert_caller_access(p_company_id, p_branch_id);

  IF v_presentation NOT IN ('raw', 'canonical') THEN
    RAISE EXCEPTION 'INVALID_PRESENTATION: expected raw|canonical, got %', p_presentation;
  END IF;

  WITH je_lines AS (
    SELECT
      jel.account_id AS aid,
      jel.debit AS dr,
      jel.credit AS cr,
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
  effective_lines AS (
    SELECT
      CASE
        WHEN v_presentation = 'raw' THEN bf.aid
        ELSE COALESCE(ara.canonical_account_id, bf.aid)
      END AS effective_aid,
      bf.aid AS source_aid,
      bf.dr,
      bf.cr
    FROM basis_filtered bf
    LEFT JOIN public.account_reporting_aliases ara
      ON ara.company_id = p_company_id
     AND ara.source_account_id = bf.aid
     AND v_presentation = 'canonical'
  ),
  per_account AS (
    SELECT
      el.effective_aid AS aid,
      SUM(el.dr)::numeric AS total_debit,
      SUM(el.cr)::numeric AS total_credit,
      SUM(el.dr - el.cr)::numeric AS net_balance
    FROM effective_lines el
    GROUP BY el.effective_aid
  ),
  source_sets AS (
    SELECT
      pa.aid,
      (
        SELECT COALESCE(json_agg(x.sid ORDER BY x.code NULLS LAST), '[]'::json)
        FROM (
          SELECT DISTINCT s.source_aid AS sid, a.code
          FROM effective_lines s
          LEFT JOIN public.accounts a ON a.id = s.source_aid
          WHERE s.effective_aid = pa.aid
          UNION
          SELECT ara.source_account_id, src.code
          FROM public.account_reporting_aliases ara
          INNER JOIN public.accounts src ON src.id = ara.source_account_id
          WHERE v_presentation = 'canonical'
            AND ara.company_id = p_company_id
            AND ara.canonical_account_id = pa.aid
          UNION
          SELECT pa.aid, acc.code
          FROM public.accounts acc
          WHERE acc.id = pa.aid
        ) x
      ) AS source_account_ids
    FROM per_account pa
  )
  SELECT json_build_object(
    'company_id', p_company_id,
    'branch_id', p_branch_id,
    'as_of_date', p_as_of_date,
    'basis', COALESCE(p_basis, 'official_gl'),
    'presentation', v_presentation,
    'total_debit', COALESCE((SELECT SUM(total_debit) FROM per_account), 0),
    'total_credit', COALESCE((SELECT SUM(total_credit) FROM per_account), 0),
    'difference', COALESCE((SELECT SUM(total_debit - total_credit) FROM per_account), 0),
    'account_count', (SELECT COUNT(*) FROM per_account),
    'accounts', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'account_id', pa.aid,
          'account_code', acc.code,
          'account_name', COALESCE(NULLIF(TRIM(ct.name), ''), acc.name),
          'account_type', acc.type,
          'linked_contact_id', acc.linked_contact_id,
          'total_debit', pa.total_debit,
          'total_credit', pa.total_credit,
          'net_balance', pa.net_balance,
          'source_account_count', COALESCE(json_array_length(ss.source_account_ids), 1),
          'source_account_ids', COALESCE(ss.source_account_ids, json_build_array(pa.aid))
        )
        ORDER BY acc.code NULLS LAST
      )
      FROM per_account pa
      INNER JOIN accounts acc ON acc.id = pa.aid
      LEFT JOIN contacts ct ON ct.id = acc.linked_contact_id
      LEFT JOIN source_sets ss ON ss.aid = pa.aid),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$BODY$;

COMMENT ON FUNCTION public.get_unified_trial_balance(uuid, uuid, date, text, text) IS
  'Unified trial balance (as-of). p_presentation=canonical rolls account_reporting_aliases; raw = exact account_id. Totals invariant.';

GRANT EXECUTE ON FUNCTION public.get_unified_trial_balance(uuid, uuid, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_trial_balance(uuid, uuid, date, text, text) TO service_role;

COMMIT;
