-- Single Core Ledger — shadow RPC draft (Phase 1)
-- Does NOT modify existing RPCs (get_customer_ar_gl_ledger_for_contact, etc.)
-- Additive only: new get_unified_party_ledger + get_unified_account_ledger
-- Basis: official_gl | effective_party | audit_full_history

-- ---------------------------------------------------------------------------
-- Helper: basis filter on attributed journal rows (mirrors reportVisibilityContract)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._unified_ledger_basis_includes_row(
  p_basis text,
  p_reference_type text,
  p_action_fingerprint text,
  p_payment_voided_at timestamptz,
  p_linked_sale_status text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $BODY$
  SELECT CASE
    WHEN LOWER(TRIM(COALESCE(p_basis, ''))) NOT IN ('official_gl', 'effective_party', 'audit_full_history') THEN FALSE
    -- Void JEs excluded at query level; this handles row-level effective filters
    WHEN LOWER(TRIM(COALESCE(p_basis, ''))) = 'official_gl' THEN TRUE
    WHEN LOWER(TRIM(COALESCE(p_basis, ''))) = 'audit_full_history' THEN TRUE
    -- effective_party: hide correction_reversal, voided payments, cancelled sale trails
    WHEN LOWER(TRIM(COALESCE(p_reference_type, ''))) = 'correction_reversal' THEN FALSE
    WHEN p_payment_voided_at IS NOT NULL THEN FALSE
    WHEN LOWER(TRIM(COALESCE(p_linked_sale_status, ''))) = 'cancelled'
      AND LOWER(TRIM(COALESCE(p_reference_type, ''))) IN ('sale', 'sale_reversal', 'sale_return', 'payment') THEN FALSE
    WHEN LOWER(TRIM(COALESCE(p_reference_type, ''))) = 'gl_correction'
      AND TRIM(COALESCE(p_action_fingerprint, '')) LIKE 'developer_repair:gl_correction:%orphan-ar' THEN FALSE
    ELSE TRUE
  END;
$BODY$;

COMMENT ON FUNCTION public._unified_ledger_basis_includes_row(text, text, text, timestamptz, text) IS
  'Phase 1 shadow basis filter for unified ledger RPCs. effective_party hides JE-0168-class reversals and void/cancelled trails.';

-- ---------------------------------------------------------------------------
-- get_unified_party_ledger — customer | supplier | worker
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
    -- Worker: include advance 1180 subtree
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
      AND (p_branch_id IS NULL OR je.branch_id IS NULL OR je.branch_id = p_branch_id)
  ),
  je_attributed AS (
    SELECT
      j.*,
      COALESCE(j.acc_linked_contact_id, j.party_resolved) AS party_id
    FROM je_lines j
  ),
  for_party AS (
    SELECT * FROM je_attributed WHERE party_id = p_party_id
  ),
  basis_filtered AS (
    SELECT f.*
    FROM for_party f
    WHERE public._unified_ledger_basis_includes_row(
      p_basis,
      f.ref_type,
      f.action_fp,
      f.pay_voided_at,
      f.linked_sale_status::text
    )
  ),
  opening_calc AS (
    SELECT COALESCE(SUM(
      CASE WHEN v_balance_sign = 1 THEN bf.dr - bf.cr ELSE bf.cr - bf.dr END
    ), 0)::numeric AS ob
    FROM basis_filtered bf
    WHERE p_start_date IS NOT NULL AND bf.ed < p_start_date
  ),
  ob_val AS (
    SELECT COALESCE((SELECT ob FROM opening_calc), 0::numeric) AS v
  ),
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
    'period_opening_balance', (SELECT v FROM ob_val),
    'row_count', (SELECT COUNT(*) FROM with_running),
    'rows', COALESCE(
      (
        SELECT json_agg(
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
        )
        FROM with_running t
      ),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$BODY$;

COMMENT ON FUNCTION public.get_unified_party_ledger(uuid, text, uuid, uuid, date, date, text) IS
  'Shadow unified party ledger (Phase 1). Journal lines only. basis: official_gl | effective_party | audit_full_history. Does not replace legacy RPCs.';

GRANT EXECUTE ON FUNCTION public.get_unified_party_ledger(uuid, text, uuid, uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_party_ledger(uuid, text, uuid, uuid, date, date, text) TO service_role;

-- ---------------------------------------------------------------------------
-- get_unified_account_ledger — single COA account
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $BODY$
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
      AND (p_branch_id IS NULL OR je.branch_id IS NULL OR je.branch_id = p_branch_id)
  ),
  basis_filtered AS (
    SELECT j.*
    FROM je_lines j
    WHERE public._unified_ledger_basis_includes_row(
      COALESCE(p_basis, 'official_gl'),
      j.ref_type,
      j.action_fp,
      j.pay_voided_at,
      j.linked_sale_status::text
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
  );
$BODY$;

COMMENT ON FUNCTION public.get_unified_account_ledger(uuid, uuid, uuid, date, date, text) IS
  'Shadow unified account ledger (Phase 1). Journal lines for one account_id.';

GRANT EXECUTE ON FUNCTION public.get_unified_account_ledger(uuid, uuid, uuid, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_account_ledger(uuid, uuid, uuid, date, date, text) TO service_role;
