-- Single Core Ledger — Phase 1.5 RPC hardening
-- Uses EXISTING auth helpers: get_user_company_id(), get_user_role(), has_branch_access()
-- Strict branch filter: NULL branch transactional rows excluded from branch-specific ledgers
-- Additive: cash/bank RPC, trial balance RPC; updates shadow party/account RPCs

-- ---------------------------------------------------------------------------
-- Strict branch filter (NULL branch only for verified opening/system refs)
-- ---------------------------------------------------------------------------
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
      OR LOWER(TRIM(COALESCE(p_reference_type, ''))) IN ('system_seed', 'coa_opening')
    ) THEN TRUE
    ELSE FALSE
  END;
$BODY$;

COMMENT ON FUNCTION public._unified_ledger_strict_branch_includes_row(uuid, uuid, text) IS
  'Phase 1.5 branch filter. Excludes NULL-branch transactional rows from branch-specific ledgers.';

-- ---------------------------------------------------------------------------
-- Caller access assert — existing project helpers only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._unified_ledger_assert_caller_access(
  p_company_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $BODY$
DECLARE
  v_role text;
  v_jwt_role text;
BEGIN
  v_jwt_role := COALESCE(current_setting('request.jwt.claim.role', true), '');

  -- Staging CLI / migrations / service_role (no end-user session)
  IF auth.uid() IS NULL THEN
    IF current_user IN ('postgres', 'supabase_admin', 'authenticator')
       OR v_jwt_role = 'service_role' THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'ACCESS_DENIED: not authenticated';
  END IF;

  IF p_company_id IS DISTINCT FROM public.get_user_company_id() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: company scope mismatch';
  END IF;

  v_role := LOWER(TRIM(COALESCE(public.get_user_role()::text, '')));

  IF v_role IN (
    'admin', 'owner', 'super_admin', 'developer', 'accounting_auditor',
    'manager', 'accountant'
  ) THEN
    RETURN;
  END IF;

  IF p_branch_id IS NOT NULL AND NOT public.has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: branch access required for branch %', p_branch_id;
  END IF;
END;
$BODY$;

COMMENT ON FUNCTION public._unified_ledger_assert_caller_access(uuid, uuid) IS
  'Unified ledger access gate using get_user_company_id(), get_user_role(), has_branch_access().';

-- ---------------------------------------------------------------------------
-- Liquidity account predicate (mirrors liquidityPaymentAccount.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._unified_ledger_is_liquidity_account(
  p_code text,
  p_name text,
  p_type text,
  p_liquidity text DEFAULT 'all'
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $BODY$
DECLARE
  v_code text := TRIM(COALESCE(p_code, ''));
  v_digits text := regexp_replace(v_code, '\D', '', 'g');
  v_type text := LOWER(TRIM(COALESCE(p_type, '')));
  v_name text := LOWER(TRIM(COALESCE(p_name, '')));
  v_is_liq boolean := FALSE;
BEGIN
  IF v_code IN ('1000', '1010', '1020') THEN v_is_liq := TRUE;
  ELSIF length(v_digits) >= 3 AND v_digits LIKE '102%' THEN v_is_liq := TRUE;
  ELSIF v_type IN ('cash', 'bank', 'mobile_wallet', 'wallet', 'card', 'pos') THEN v_is_liq := TRUE;
  ELSIF v_name ~* 'cash|bank|mobile wallet|wallet|jazz|easypaisa|ndm|easy\s*paisa|mobicash|finja|upaisa|sadapay|nayapay' THEN
    v_is_liq := TRUE;
  END IF;

  IF NOT v_is_liq THEN RETURN FALSE; END IF;

  p_liquidity := LOWER(TRIM(COALESCE(p_liquidity, 'all')));
  IF p_liquidity = 'all' THEN RETURN TRUE; END IF;

  IF p_liquidity = 'bank' THEN
    RETURN v_type IN ('bank', 'card') OR v_code = '1010' OR v_digits LIKE '101%';
  ELSIF p_liquidity = 'wallet' THEN
    RETURN v_type IN ('mobile_wallet', 'wallet') OR v_code = '1020' OR v_digits LIKE '102%'
      OR v_name ~* 'wallet|jazz|easypaisa|sadapay|nayapay';
  ELSIF p_liquidity = 'cash' THEN
    RETURN v_type = 'cash' OR v_code = '1000' OR v_digits LIKE '100%';
  END IF;

  RETURN FALSE;
END;
$BODY$;

-- ---------------------------------------------------------------------------
-- Patch get_unified_party_ledger — access assert + strict branch filter
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unified_party_ledger(
  p_company_id uuid,
  p_party_type text,
  p_party_id uuid,
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
  v_control_code text;
  v_balance_sign int;
  v_result json;
BEGIN
  PERFORM public._unified_ledger_assert_caller_access(p_company_id, p_branch_id);

  IF p_company_id IS NULL OR p_party_id IS NULL THEN
    RETURN json_build_object('error', 'company_id and party_id required', 'rows', '[]'::json);
  END IF;

  p_party_type := LOWER(TRIM(COALESCE(p_party_type, '')));
  p_basis := LOWER(TRIM(COALESCE(p_basis, 'official_gl')));
  IF p_basis NOT IN ('official_gl', 'effective_party', 'audit_full_history') THEN
    p_basis := 'official_gl';
  END IF;

  CASE p_party_type
    WHEN 'customer' THEN v_control_code := '1100'; v_balance_sign := 1;
    WHEN 'supplier' THEN v_control_code := '2000'; v_balance_sign := -1;
    WHEN 'worker' THEN v_control_code := '2010'; v_balance_sign := -1;
    ELSE
      RETURN json_build_object('error', 'invalid party_type', 'rows', '[]'::json);
  END CASE;

  WITH control_root AS (
    SELECT a.id AS root_id
    FROM accounts a
    WHERE a.company_id = p_company_id
      AND TRIM(COALESCE(a.code, '')) = v_control_code
      AND COALESCE(a.is_active, TRUE)
    LIMIT 1
  ),
  subtree AS (
    WITH RECURSIVE sub AS (
      SELECT root_id AS id FROM control_root WHERE root_id IS NOT NULL
      UNION ALL
      SELECT a.id
      FROM accounts a
      INNER JOIN sub s ON a.parent_id = s.id
      WHERE a.company_id = p_company_id AND COALESCE(a.is_active, TRUE)
    )
    SELECT id FROM sub
    UNION
    SELECT a.id FROM accounts a
    WHERE p_party_type = 'worker'
      AND a.company_id = p_company_id
      AND TRIM(COALESCE(a.code, '')) = '1180'
      AND COALESCE(a.is_active, TRUE)
  ),
  je_lines AS (
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
      COALESCE(
        je.payment_id,
        CASE
          WHEN lower(trim(COALESCE(je.reference_type, ''))) = 'payment_adjustment'
            AND je.reference_id IS NOT NULL
            AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN je.reference_id::uuid
          ELSE NULL
        END
      ) AS pid,
      je.branch_id AS bid,
      br.name AS bname,
      TRIM(COALESCE(acc.code, '')) AS acode,
      COALESCE(acc.name, '') AS aname,
      acc.linked_contact_id AS acc_linked_contact_id,
      CASE
        WHEN LOWER(TRIM(COALESCE(je.reference_type, ''))) = 'correction_reversal'
          AND je.reference_id IS NOT NULL
          AND je.reference_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public._gl_resolve_party_id_for_journal_entry(p_company_id, je.reference_id::uuid)
        ELSE public._gl_resolve_party_id_for_journal_entry(p_company_id, je.id)
      END AS party_resolved,
      pay.voided_at AS pay_voided_at,
      s.status AS linked_sale_status
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
    INNER JOIN accounts acc ON acc.id = jel.account_id AND acc.company_id = p_company_id
    LEFT JOIN branches br ON br.id = je.branch_id
    LEFT JOIN payments pay ON pay.id = COALESCE(
      je.payment_id,
      CASE WHEN lower(trim(COALESCE(je.reference_type, ''))) = 'payment_adjustment' THEN je.reference_id::uuid ELSE NULL END
    )
    LEFT JOIN sales s ON s.id = je.reference_id
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'sale_adjustment', 'sale_reversal')
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND jel.account_id IN (SELECT id FROM subtree)
      AND public._unified_ledger_strict_branch_includes_row(p_branch_id, je.branch_id, je.reference_type)
  ),
  je_attributed AS (
    SELECT j.*, COALESCE(j.acc_linked_contact_id, j.party_resolved) AS party_id
    FROM je_lines j
  ),
  for_party AS (
    SELECT * FROM je_attributed WHERE party_id = p_party_id
  ),
  basis_filtered AS (
    SELECT f.*
    FROM for_party f
    WHERE public._unified_ledger_basis_includes_row(
      p_basis, f.ref_type, f.action_fp, f.pay_voided_at, f.linked_sale_status::text
    )
  ),
  opening_calc AS (
    SELECT COALESCE(SUM(
      CASE WHEN v_balance_sign = 1 THEN bf.dr - bf.cr ELSE bf.cr - bf.dr END
    ), 0)::numeric AS ob
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
      o.pob + SUM(
        CASE WHEN v_balance_sign = 1 THEN o.dr - o.cr ELSE o.cr - o.dr END
      ) OVER (
        ORDER BY o.ed ASC, o.ca ASC NULLS LAST, o.eno ASC NULLS LAST, o.jel_id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS rb
    FROM ordered o
  )
  SELECT json_build_object(
    'party_type', p_party_type,
    'party_id', p_party_id,
    'basis', p_basis,
    'branch_id', p_branch_id,
    'period_opening_balance', (SELECT v FROM ob_val),
    'row_count', (SELECT COUNT(*) FROM with_running),
    'rows', COALESCE(
      (SELECT json_agg(
        json_build_object(
          'journal_entry_line_id', t.jel_id,
          'journal_entry_id', t.je_id,
          'entry_date', t.ed,
          'created_at', t.ca,
          'entry_no', t.eno,
          'reference_type', t.ref_type,
          'description', t.descr,
          'debit', t.dr,
          'credit', t.cr,
          'running_balance', t.rb,
          'period_opening_balance', t.pob,
          'payment_id', t.pid,
          'branch_id', t.bid,
          'branch_name', t.bname,
          'account_code', t.acode,
          'account_name', t.aname,
          'party_resolved', t.party_resolved,
          'account_linked_contact_id', t.acc_linked_contact_id
        )
        ORDER BY t.ed ASC, t.ca ASC NULLS LAST, t.eno ASC NULLS LAST, t.jel_id ASC
      ) FROM with_running t),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$BODY$;

-- ---------------------------------------------------------------------------
-- Patch get_unified_account_ledger
-- ---------------------------------------------------------------------------
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
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND jel.account_id = p_account_id
      AND public._unified_ledger_strict_branch_includes_row(p_branch_id, je.branch_id, je.reference_type)
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

-- ---------------------------------------------------------------------------
-- get_unified_cash_bank_ledger — single RPC (replaces TS per-account loop)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unified_cash_bank_ledger(
  p_company_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_basis text DEFAULT 'official_gl',
  p_liquidity text DEFAULT 'all'
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

  WITH liq_accounts AS (
    SELECT a.id, a.code, a.name, a.type
    FROM accounts a
    WHERE a.company_id = p_company_id
      AND COALESCE(a.is_active, TRUE)
      AND public._unified_ledger_is_liquidity_account(a.code, a.name, a.type::text, p_liquidity)
  ),
  je_lines AS (
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
      TRIM(COALESCE(acc.code, '')) AS acode,
      COALESCE(acc.name, '') AS aname,
      pay.voided_at AS pay_voided_at,
      s.status AS linked_sale_status
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
    INNER JOIN liq_accounts acc ON acc.id = jel.account_id
    LEFT JOIN branches br ON br.id = je.branch_id
    LEFT JOIN payments pay ON pay.id = je.payment_id
    LEFT JOIN sales s ON s.id = je.reference_id
      AND LOWER(TRIM(COALESCE(je.reference_type, ''))) IN ('sale', 'sale_adjustment', 'sale_reversal')
    WHERE je.company_id = p_company_id
      AND COALESCE(je.is_void, FALSE) = FALSE
      AND public._unified_ledger_strict_branch_includes_row(p_branch_id, je.branch_id, je.reference_type)
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
    'basis', COALESCE(p_basis, 'official_gl'),
    'liquidity', COALESCE(p_liquidity, 'all'),
    'branch_id', p_branch_id,
    'liquidity_account_count', (SELECT COUNT(*) FROM liq_accounts),
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
          'branch_name', t.bname,
          'account_code', t.acode,
          'account_name', t.aname
        )
        ORDER BY t.ed ASC, t.ca ASC NULLS LAST, t.eno ASC NULLS LAST, t.jel_id ASC
      ) FROM with_running t),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$BODY$;

COMMENT ON FUNCTION public.get_unified_cash_bank_ledger(uuid, uuid, date, date, text, text) IS
  'Phase 1.5 unified cash/bank/wallet ledger. Liquidity detection mirrors liquidityPaymentAccount.ts.';

GRANT EXECUTE ON FUNCTION public.get_unified_cash_bank_ledger(uuid, uuid, date, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_cash_bank_ledger(uuid, uuid, date, date, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- get_unified_trial_balance
-- ---------------------------------------------------------------------------
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
      AND COALESCE(je.is_void, FALSE) = FALSE
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
  'Phase 1.5 unified trial balance from journal lines with basis + strict branch filter.';

GRANT EXECUTE ON FUNCTION public.get_unified_trial_balance(uuid, uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_trial_balance(uuid, uuid, date, text) TO service_role;
